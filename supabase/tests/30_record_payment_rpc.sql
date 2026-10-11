-- Tests for record_payment(): atomicity, ownership, idempotent replay.
-- Run by `npm run test:db`. Mirrors what services/supabase-repository.ts does.

create temp table fixture (key text primary key, value uuid) on commit preserve rows;

do $$
declare a uuid; b uuid; sub uuid;
begin
  -- role/GUC state is per-transaction; start from a known identity
  execute 'reset role';
  insert into auth.users (email) values ('payer@example.invalid') returning id into a;
  insert into auth.users (email) values ('other@example.invalid') returning id into b;
  insert into fixture (key, value) values ('a', a), ('b', b);

  insert into public.subscriptions (user_id, name, amount_cents, currency, interval_every, interval_unit, next_billing_date, status)
  values (a, 'Netflix', 1549, 'USD', 1, 'month', date '2030-01-15', 'active') returning id into sub;
end;
$$;

-- 1. One call writes both the event and the rolled schedule.
do $$
declare a uuid; sub uuid; events bigint; next_date date;
begin
  execute 'reset role';
  select value into a from fixture where key = 'a';
  select id into sub from public.subscriptions where user_id = a;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', a::text, true);

  perform public.record_payment(sub, date '2030-01-15', 1549, date '2030-02-15', gen_random_uuid());

  execute 'reset role';
  select count(*) into events from public.billing_events where subscription_id = sub;
  if events <> 1 then raise exception 'FAIL: expected 1 billing event, found %', events; end if;

  select next_billing_date into next_date from public.subscriptions where id = sub;
  if next_date <> date '2030-02-15' then
    raise exception 'FAIL: schedule was not rolled forward (got %)', next_date;
  end if;
end;
$$;

-- 2. A replayed request id is a no-op: no second event, no double roll.
do $$
declare a uuid; sub uuid; events bigint; next_date date; request uuid;
begin
  execute 'reset role';
  select value into a from fixture where key = 'a';
  select id into sub from public.subscriptions where user_id = a;
  request := gen_random_uuid();

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', a::text, true);

  perform public.record_payment(sub, date '2030-02-15', 1549, date '2030-03-15', request);
  select count(*) into events from public.billing_events where subscription_id = sub;
  if events <> 2 then raise exception 'FAIL: first attempt recorded % events (expected 2)', events; end if;

  -- Same request id again — e.g. the client retried after a timeout.
  perform public.record_payment(sub, date '2030-02-15', 1549, date '2030-04-15', request);

  execute 'reset role';
  select count(*) into events from public.billing_events where subscription_id = sub;
  if events <> 2 then raise exception 'FAIL: replay duplicated charge history (% events)', events; end if;
  select next_billing_date into next_date from public.subscriptions where id = sub;
  if next_date <> date '2030-03-15' then
    raise exception 'FAIL: replay moved the schedule again (now %)', next_date;
  end if;
end;
$$;

-- 3. Another user cannot record a payment against someone else's subscription.
do $$
declare a uuid; b uuid; sub uuid; blocked boolean;
begin
  execute 'reset role';
  select value into a from fixture where key = 'a';
  select value into b from fixture where key = 'b';
  select id into sub from public.subscriptions where user_id = a;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', b::text, true);

  blocked := false;
  begin
    perform public.record_payment(sub, date '2030-01-15', 1549, date '2030-02-15', gen_random_uuid());
  exception when raise_exception then
    if sqlerrm like 'leakify:%' then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'FAIL: user B recorded a payment on user A subscription'; end if;

  execute 'reset role';
  if (select count(*) from public.billing_events where subscription_id = sub and user_id = b) <> 0 then
    raise exception 'FAIL: cross-user write produced a billing event';
  end if;
end;
$$;

-- 4. Refusals: no schedule to roll, a date that does not move forward, and a
--    negative amount. Each must abort the whole call (no orphan event).
do $$
declare a uuid; sub uuid; fresh uuid; code text; events bigint;
begin
  execute 'reset role';
  select value into a from fixture where key = 'a';
  select id into sub from public.subscriptions where user_id = a;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', a::text, true);

  code := null;
  begin
    -- Rewinding (or repeating) the schedule is refused.
    perform public.record_payment(sub, date '2030-03-15', 1549, date '2030-03-15', gen_random_uuid());
  exception when raise_exception then
    code := sqlerrm;
  end;
  if code is null or code not like 'leakify:invalid_next_billing_date%' then
    raise exception 'FAIL: non-advancing next_billing_date was accepted (got %)', coalesce(code, 'no error');
  end if;

  code := null;
  begin
    perform public.record_payment(sub, date '2030-03-15', -1, date '2030-04-15', gen_random_uuid());
  exception when raise_exception then
    code := sqlerrm;
  end;
  if code is null or code not like 'leakify:invalid_amount%' then
    raise exception 'FAIL: negative amount was accepted (got %)', coalesce(code, 'no error');
  end if;

  -- A subscription without a billing date cannot be "recorded" at all.
  insert into public.subscriptions (user_id, name, amount_cents, currency, interval_every, interval_unit, next_billing_date)
  values (a, 'No schedule', 500, 'USD', 1, 'month', null) returning id into fresh;
  code := null;
  begin
    perform public.record_payment(fresh, date '2030-03-15', 500, date '2030-04-15', gen_random_uuid());
  exception when raise_exception then
    code := sqlerrm;
  end;
  if code is null or code not like 'leakify:no_next_billing_date%' then
    raise exception 'FAIL: missing schedule accepted (got %)', coalesce(code, 'no error');
  end if;

  execute 'reset role';
  select count(*) into events from public.billing_events where subscription_id = fresh;
  if events <> 0 then raise exception 'FAIL: a rejected call still wrote billing history'; end if;
end;
$$;

-- 5. A trial payment flips the status to active inside the same transaction.
do $$
declare a uuid; sub uuid; sub_status text; event_type text;
begin
  execute 'reset role';
  select value into a from fixture where key = 'a';
  insert into public.subscriptions (user_id, name, amount_cents, currency, interval_every, interval_unit, next_billing_date, trial_end_date, status)
  values (a, 'Trial Service', 900, 'USD', 1, 'month', null, null, 'trialing') returning id into sub;
  -- A trialing row needs a schedule to roll, so give it one.
  update public.subscriptions set next_billing_date = date '2030-05-01' where id = sub;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.record_payment(sub, date '2030-05-01', 1000, date '2030-06-01', gen_random_uuid());

  execute 'reset role';
  select s.status into sub_status from public.subscriptions s where s.id = sub;
  if sub_status <> 'active' then raise exception 'FAIL: trial did not become active (status %)', sub_status; end if;
  select b.type into event_type from public.billing_events b where b.subscription_id = sub;
  if event_type <> 'trial_end' then raise exception 'FAIL: trial payment typed as %', event_type; end if;
end;
$$;
