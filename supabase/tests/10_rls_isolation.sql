-- Row Level Security / two-user isolation tests.
--
-- Executed by `npm run test:db` (scripts/db-tests.mjs) against a disposable
-- Postgres database after supabase/migrations/*.sql. Every failing assertion
-- raises an exception, which fails the CI job. This suite is the regression net
-- for the claim "RLS is the cloud authorization boundary": weaken a policy and
-- one of these blocks starts failing.
--
-- Scenario: user_a owns Netflix + a billing event + preferences + a scheduled
-- reminder; user_b owns a gym plan + a billing event; user_c exists but has no
-- rows (used to test forging an owner where no unique constraint masks the
-- policy result). Identity is switched the way PostgREST does it: the
-- `authenticated` role plus request.jwt.claim.* GUCs.

-- ---------------------------------------------------------------------------
-- Fixtures, created as the table owner (as Supabase's postgres role is).
-- ---------------------------------------------------------------------------
create temp table fixture (key text primary key, value uuid) on commit preserve rows;

do $$
declare a uuid; b uuid; c uuid;
begin
  -- role/GUC state is per-transaction; start from a known identity
  execute 'reset role';
  insert into auth.users (email, raw_user_meta_data)
  values ('a@example.invalid', '{"display_name":"User A"}'::jsonb) returning id into a;
  insert into auth.users (email, raw_user_meta_data)
  values ('b@example.invalid', '{"display_name":"User B"}'::jsonb) returning id into b;
  insert into auth.users (email, raw_user_meta_data)
  values ('c@example.invalid', '{"display_name":"User C"}'::jsonb) returning id into c;

  insert into fixture (key, value) values ('a', a), ('b', b), ('c', c);

  -- The signup trigger must create a profile per auth user...
  if (select count(*) from public.profiles where id in (a, b, c)) <> 3 then
    raise exception 'FAIL: on_auth_user_created trigger did not create a profile per signup';
  end if;
  -- ...and copy the display name from signup metadata.
  if (select display_name from public.profiles where id = a) <> 'User A' then
    raise exception 'FAIL: profile trigger did not copy display_name from user metadata';
  end if;

  -- user_c gets no rows at all, so any write attributed to them is a forgery.
  delete from public.profiles where id = c;

  insert into public.subscriptions (user_id, name, amount_cents, currency, interval_every, interval_unit, next_billing_date)
  values
    (a, 'Netflix', 1549, 'USD', 1, 'month', date '2030-01-15'),
    (b, 'Gym', 2900, 'USD', 1, 'month', date '2030-01-20');

  insert into public.billing_events (subscription_id, user_id, expected_date, amount_cents, currency, type, status)
  select s.id, s.user_id, s.next_billing_date, s.amount_cents, s.currency, 'renewal', 'charged'
  from public.subscriptions s;

  insert into public.notification_preferences (user_id, renewal_lead_days, preview_mode)
  values (a, '{3,1,0}', 'generic'), (b, '{7}', 'detailed');

  insert into public.notification_records (user_id, subscription_id, dedup_key, type, occurrence_date)
  select a, s.id, 'a:renewal:1', 'renewal', date '2030-01-15'
  from public.subscriptions s where s.user_id = a;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. SELECT: each user sees exactly their own rows.
-- ---------------------------------------------------------------------------
do $$
declare a uuid; b uuid; n bigint;
begin
  -- role/GUC state is per-transaction; start from a known identity
  execute 'reset role';
  select value into a from fixture where key = 'a';
  select value into b from fixture where key = 'b';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', a::text, true);

  select count(*) into n from public.subscriptions;
  if n <> 1 then raise exception 'FAIL: user A saw % subscription rows, expected their own 1', n; end if;

  select count(*) into n from public.billing_events;
  if n <> 1 then raise exception 'FAIL: user A saw % billing events, expected 1', n; end if;

  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'FAIL: user A saw % profile rows, expected 1', n; end if;

  select count(*) into n from public.notification_records;
  if n <> 1 then raise exception 'FAIL: user A saw % notification records, expected 1', n; end if;

  select count(*) into n from public.notification_preferences;
  if n <> 1 then raise exception 'FAIL: user A saw % preference rows, expected 1', n; end if;

  -- Reaching explicitly for B's rows returns nothing rather than erroring.
  select count(*) into n from public.subscriptions where user_id = b;
  if n <> 0 then raise exception 'FAIL: user A could read user B subscriptions'; end if;

  select count(*) into n from public.notification_preferences where user_id = b;
  if n <> 0 then raise exception 'FAIL: user A could read user B notification preferences'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. UPDATE / DELETE against another owner's rows must match zero rows.
-- ---------------------------------------------------------------------------
do $$
declare a uuid; b uuid; b_sub uuid; b_billing uuid; n bigint;
begin
  -- role/GUC state is per-transaction; start from a known identity
  execute 'reset role';
  select value into a from fixture where key = 'a';
  select value into b from fixture where key = 'b';
  select id into b_sub from public.subscriptions where user_id = b;
  select be.id into b_billing
  from public.billing_events be join public.subscriptions s on s.id = be.subscription_id
  where s.user_id = b;
  if b_billing is null then raise exception 'FAIL: fixture missing — user B has no billing event to protect'; end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', a::text, true);

  update public.subscriptions set name = 'Hijacked' where id = b_sub;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: user A updated a subscription owned by user B (% rows)', n; end if;

  delete from public.subscriptions where id = b_sub;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: user A deleted a subscription owned by user B (% rows)', n; end if;

  delete from public.billing_events where id = b_billing;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: user A deleted billing history owned by user B (% rows)', n; end if;

  update public.notification_preferences set preview_mode = 'detailed' where user_id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: user A altered user B notification preferences (% rows)', n; end if;

  delete from public.notification_records where user_id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: user A deleted user B notification records (% rows)', n; end if;

  -- Own rows stay writable, including the delete path the app uses.
  delete from public.notification_preferences where user_id = a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: user A could not delete their own preference row (% rows)', n; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. INSERT / WITH CHECK: a client cannot claim another user as owner.
-- ---------------------------------------------------------------------------
do $$
declare a uuid; c uuid; denied boolean;
begin
  -- role/GUC state is per-transaction; start from a known identity
  execute 'reset role';
  -- Read the fixture before dropping to the app role: temp tables belong to the
  -- owner and are deliberately not readable by `authenticated`.
  select value into a from fixture where key = 'a';
  select value into c from fixture where key = 'c';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  -- The session authenticates as user A while every insert claims user C as
  -- owner, which the WITH CHECK clause must refuse.
  perform set_config('request.jwt.claim.sub', a::text, true);

  denied := false;
  begin
    insert into public.subscriptions (user_id, name, amount_cents, currency, interval_every, interval_unit)
    values (c, 'Forged', 100, 'USD', 1, 'month');
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then raise exception 'FAIL: user A inserted a subscription owned by user C'; end if;

  denied := false;
  begin
    insert into public.profiles (id, display_name) values (c, 'Forged profile');
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then raise exception 'FAIL: user A wrote a profile row for user C'; end if;

  denied := false;
  begin
    insert into public.notification_preferences (user_id, renewal_lead_days)
    values (c, '{30}');
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then raise exception 'FAIL: user A wrote notification preferences for user C'; end if;

  if exists (select 1 from public.profiles where id = c) then
    raise exception 'FAIL: a forged profile row survived';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Same-owner writes keep working end to end (a policy that locks the owner
--    out is just as broken as one that lets strangers in).
-- ---------------------------------------------------------------------------
do $$
declare a uuid; sub uuid; n bigint;
begin
  -- role/GUC state is per-transaction; start from a known identity
  execute 'reset role';
  select value into a from fixture where key = 'a';
  select id into sub from public.subscriptions where user_id = a;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', a::text, true);

  update public.subscriptions set amount_cents = 1799 where id = sub;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: user A could not update their own subscription (% rows)', n; end if;

  insert into public.billing_events (subscription_id, user_id, expected_date, amount_cents, currency, type)
  values (sub, a, date '2030-02-15', 1799, 'USD', 'renewal');
  select count(*) into n from public.billing_events where subscription_id = sub;
  if n <> 2 then raise exception 'FAIL: same-owner billing event was not recorded (% rows)', n; end if;

  insert into public.notification_preferences (user_id, renewal_lead_days, preview_mode)
  values (a, '{1}', 'detailed')
  on conflict (user_id) do update set preview_mode = excluded.preview_mode, renewal_lead_days = excluded.renewal_lead_days;

  execute 'reset role';
  if (select preview_mode from public.notification_preferences where user_id = a) <> 'detailed' then
    raise exception 'FAIL: preview_mode upsert did not persist';
  end if;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', a::text, true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. The update path must also refuse to hand a row to another user.
-- ---------------------------------------------------------------------------
do $$
declare a uuid; b uuid; sub uuid; n bigint;
begin
  -- role/GUC state is per-transaction; start from a known identity
  execute 'reset role';
  select value into a from fixture where key = 'a';
  select value into b from fixture where key = 'b';
  select id into sub from public.subscriptions where user_id = a;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', a::text, true);

  -- Either outcome is safe: the WITH CHECK clause raises, or the USING clause
  -- matches nothing. What must never happen is the row changing owner.
  begin
    update public.subscriptions set user_id = b where id = sub;
  exception when insufficient_privilege then
    null; -- RLS WITH CHECK refused the forged ownership change
  end;

  select count(*) into n from public.subscriptions where id = sub and user_id = a;
  if n <> 1 then raise exception 'FAIL: user A reassigned their subscription to user B'; end if;

  select count(*) into n from public.subscriptions where id = sub and user_id = b;
  if n <> 0 then raise exception 'FAIL: a subscription was transferred to user B by a forged update'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Deleting an auth identity cascades to every owned row — the property the
--    account-deletion path relies on to prove "all your data is gone".
-- ---------------------------------------------------------------------------
do $$
declare b uuid; n bigint;
begin
  -- role/GUC state is per-transaction; start from a known identity
  execute 'reset role';
  select value into b from fixture where key = 'b';
  if (select count(*) from public.subscriptions where user_id = b) = 0 then
    raise exception 'FAIL: fixture missing — user B has no subscription to cascade from';
  end if;

  delete from auth.users where id = b;

  select count(*) into n from public.subscriptions where user_id = b;
  if n <> 0 then raise exception 'FAIL: % subscription rows outlived the auth user (cascade missing)', n; end if;
  select count(*) into n from public.billing_events where user_id = b;
  if n <> 0 then raise exception 'FAIL: % billing rows outlived the auth user', n; end if;
  select count(*) into n from public.notification_preferences where user_id = b;
  if n <> 0 then raise exception 'FAIL: % preference rows outlived the auth user', n; end if;
  select count(*) into n from public.notification_records where user_id = b;
  if n <> 0 then raise exception 'FAIL: % notification records outlived the auth user', n; end if;
  select count(*) into n from public.profiles where id = b;
  if n <> 0 then raise exception 'FAIL: % profile rows outlived the auth user', n; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Anon (signed-out / unconfigured) clients read nothing.
-- ---------------------------------------------------------------------------
do $$
declare n bigint;
begin
  -- role/GUC state is per-transaction; start from a known identity
  execute 'reset role';
  execute 'set local role anon';
  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.jwt.claim.sub', '', true);

  select count(*) into n from public.subscriptions;
  if n <> 0 then raise exception 'FAIL: anon role read % subscription rows', n; end if;
  select count(*) into n from public.profiles;
  if n <> 0 then raise exception 'FAIL: anon role read % profile rows', n; end if;
  select count(*) into n from public.billing_events;
  if n <> 0 then raise exception 'FAIL: anon role read % billing rows', n; end if;
  select count(*) into n from public.notification_preferences;
  if n <> 0 then raise exception 'FAIL: anon role read % preference rows', n; end if;
end;
$$;
