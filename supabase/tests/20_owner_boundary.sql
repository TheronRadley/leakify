-- Owner-boundary (composite foreign key) tests, added by
-- supabase/migrations/0002_owner_bound_child_rows.sql.
--
-- These prove the database — not the client — refuses to link one user's child
-- rows to another user's subscription, and that the preflight function would
-- have caught such data before the constraint was added.

create temp table fixture (key text primary key, value uuid) on commit preserve rows;

do $$
declare a uuid; b uuid;
begin
  -- role/GUC state is per-transaction; start from a known identity
  execute 'reset role';
  insert into auth.users (email, raw_user_meta_data)
  values ('owner-a@example.invalid', '{}'::jsonb) returning id into a;
  insert into auth.users (email, raw_user_meta_data)
  values ('owner-b@example.invalid', '{}'::jsonb) returning id into b;
  insert into fixture (key, value) values ('a', a), ('b', b);

  insert into public.subscriptions (user_id, name, amount_cents, currency, interval_every, interval_unit, next_billing_date)
  values
    (a, 'A Streaming', 999, 'USD', 1, 'month', date '2030-01-10'),
    (b, 'B Cloud', 1999, 'USD', 1, 'month', date '2030-01-12');
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. The composite FK target exists and is unique per owner.
-- ---------------------------------------------------------------------------
do $$
declare c record;
begin
  -- role/GUC state is per-transaction; start from a known identity
  execute 'reset role';
  select conname into c from pg_constraint
  where conrelid = 'public.subscriptions'::regclass and contype = 'u'
    and conname = 'subscriptions_user_id_id_key';
  if c.conname is null then
    raise exception 'FAIL: subscriptions(user_id, id) unique constraint is missing';
  end if;

  select conname into c from pg_constraint
  where conrelid = 'public.billing_events'::regclass and contype = 'f'
    and conname = 'billing_events_user_subscription_fkey';
  if c.conname is null then
    raise exception 'FAIL: billing_events owner-bound foreign key is missing';
  end if;

  select conname into c from pg_constraint
  where conrelid = 'public.notification_records'::regclass and contype = 'f'
    and conname = 'notification_records_user_subscription_fkey';
  if c.conname is null then
    raise exception 'FAIL: notification_records owner-bound foreign key is missing';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. A cross-owner child row is rejected even when RLS would allow it
--    (correct user_id, another user's subscription_id) — the exact mismatch a
--    buggy client could produce.
-- ---------------------------------------------------------------------------
do $$
declare a uuid; b uuid; a_sub uuid; b_sub uuid; rejected boolean;
begin
  -- role/GUC state is per-transaction; start from a known identity
  execute 'reset role';
  select value into a from fixture where key = 'a';
  select value into b from fixture where key = 'b';
  select id into a_sub from public.subscriptions where user_id = a;
  select id into b_sub from public.subscriptions where user_id = b;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', a::text, true);

  rejected := false;
  begin
    insert into public.billing_events (subscription_id, user_id, expected_date, amount_cents, currency, type)
    values (b_sub, a, date '2030-01-20', 999, 'USD', 'renewal');
  exception when foreign_key_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'FAIL: billing_events accepted a row owned by A pointing at B subscription';
  end if;

  rejected := false;
  begin
    insert into public.notification_records (user_id, subscription_id, dedup_key, type, occurrence_date)
    values (a, b_sub, 'cross-owner', 'renewal', date '2030-01-20');
  exception when foreign_key_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'FAIL: notification_records accepted a cross-owner subscription reference';
  end if;

  -- Moving an existing valid row onto another owner's subscription is rejected
  -- too (the UPDATE path a resync might take).
  insert into public.notification_records (user_id, subscription_id, dedup_key, type, occurrence_date)
  values (a, a_sub, 'same-owner', 'renewal', date '2030-01-20');

  rejected := false;
  begin
    update public.notification_records set subscription_id = b_sub
    where user_id = a and dedup_key = 'same-owner';
  exception when foreign_key_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'FAIL: notification_records could be re-pointed at another user subscription';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Same-owner child rows remain valid, and NULL subscription_id stays valid
--    for weekly-digest records (the composite FK must not break them).
-- ---------------------------------------------------------------------------
do $$
declare a uuid; a_sub uuid; n bigint;
begin
  -- role/GUC state is per-transaction; start from a known identity
  execute 'reset role';
  select value into a from fixture where key = 'a';
  select id into a_sub from public.subscriptions where user_id = a;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', a::text, true);

  insert into public.billing_events (subscription_id, user_id, expected_date, amount_cents, currency, type)
  values (a_sub, a, date '2030-02-10', 999, 'USD', 'renewal');

  insert into public.notification_records (user_id, subscription_id, dedup_key, type, occurrence_date)
  values (a, null, 'weekly_digest:2030-02-10', 'weekly_digest', date '2030-02-10');

  select count(*) into n from public.billing_events where user_id = a;
  if n <> 1 then raise exception 'FAIL: same-owner billing event rejected (% rows written)', n; end if;
  select count(*) into n from public.notification_records where user_id = a and subscription_id is null;
  if n <> 1 then raise exception 'FAIL: digest record with NULL subscription_id was rejected'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Cascade still works within an owner, and the preflight function detects a
--    deliberately corrupted dataset instead of letting it pass silently.
-- ---------------------------------------------------------------------------
do $$
declare a uuid; b uuid; a_sub uuid; n bigint; detected boolean;
begin
  -- role/GUC state is per-transaction; start from a known identity
  execute 'reset role';
  select value into a from fixture where key = 'a';
  select value into b from fixture where key = 'b';
  select id into a_sub from public.subscriptions where user_id = a;

  delete from public.subscriptions where id = a_sub;
  select count(*) into n from public.billing_events where user_id = a;
  if n <> 0 then raise exception 'FAIL: owner delete did not cascade to billing_events (% rows left)', n; end if;
  select count(*) into n from public.notification_records where user_id = a and subscription_id is not null;
  if n <> 0 then raise exception 'FAIL: owner delete did not cascade to notification_records'; end if;

  -- Prove the migration preflight actually catches legacy inconsistency. The
  -- new constraint makes such a row impossible to write, so the only way to
  -- reproduce the pre-migration state is to suspend FK enforcement as a
  -- superuser — exactly what the preflight protects against on a staging copy.
  execute 'reset role';
  insert into public.subscriptions (user_id, name, amount_cents, currency, interval_every, interval_unit)
  values (a, 'Recreated', 500, 'USD', 1, 'month') returning id into a_sub;

  perform set_config('session_replication_role', 'replica', true);
  insert into public.billing_events (subscription_id, user_id, expected_date, amount_cents, currency, type)
  select s.id, a, date '2030-03-01', 500, 'USD', 'renewal'
  from public.subscriptions s where s.user_id = b;
  perform set_config('session_replication_role', 'origin', true);

  detected := false;
  begin
    perform public.leakify_assert_owner_boundaries();
  exception when raise_exception then
    detected := true;
  end;
  if not detected then
    raise exception 'FAIL: preflight did not detect an owner-mismatched billing row';
  end if;

  -- Documented repair path (see supabase/tests/README.md): drop or re-attribute
  -- the disputed row, after which the invariant holds again and a re-run passes.
  delete from public.billing_events be
  where be.user_id = a
    and be.subscription_id = (select id from public.subscriptions where user_id = b);

  perform public.leakify_assert_owner_boundaries();
end;
$$;
