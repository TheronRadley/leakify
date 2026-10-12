-- 0002 — Enforce subscription ownership in the schema itself.
--
-- Problem this closes (audit S-01 item 5): `billing_events.subscription_id` and
-- `notification_records.subscription_id` referenced only `subscriptions (id)`.
-- Foreign-key checks run as the table owner and therefore BYPASS Row Level
-- Security, so an authenticated user who learned another user's subscription
-- UUID could attach rows to it — their own `user_id`, someone else's
-- subscription. RLS on the child table would happily allow that, because the
-- child row belongs to the attacker.
--
-- Fix: make `(id, user_id)` uniquely referenceable on `subscriptions` and point
-- the child FKs at that pair. A child row now has to carry the SAME owner as the
-- subscription it points at, or Postgres rejects the insert outright.
--
-- Safe to re-run? No — `add constraint` is not idempotent. Supabase/`db push`
-- applies each migration once.

-- ---------------------------------------------------------------------------
-- 1. subscriptions: expose (id, user_id) as a composite reference target.
--    `id` is already the primary key, so this adds no new uniqueness — it just
--    gives child tables a pair they can point at.
-- ---------------------------------------------------------------------------
alter table public.subscriptions
  add constraint subscriptions_id_user_id_key unique (id, user_id);

-- ---------------------------------------------------------------------------
-- 2. billing_events: composite FK. A billing event can now only reference a
--    subscription owned by the same user_id the event carries.
-- ---------------------------------------------------------------------------
alter table public.billing_events
  drop constraint if exists billing_events_subscription_id_fkey;
alter table public.billing_events
  add constraint billing_events_subscription_owner_fkey
  foreign key (subscription_id, user_id)
  references public.subscriptions (id, user_id)
  on delete cascade;

-- ---------------------------------------------------------------------------
-- 3. notification_records: composite FK. `subscription_id` stays nullable
--    (weekly digests are not tied to one subscription); with the default
--    MATCH SIMPLE, a NULL in either column skips the check, so digest rows keep
--    working unchanged.
-- ---------------------------------------------------------------------------
alter table public.notification_records
  drop constraint if exists notification_records_subscription_id_fkey;
alter table public.notification_records
  add constraint notification_records_subscription_owner_fkey
  foreign key (subscription_id, user_id)
  references public.subscriptions (id, user_id)
  on delete cascade;

-- ---------------------------------------------------------------------------
-- 4. Ownership defaults (audit S-01 item 4). The client always sets user_id
--    explicitly today, but a default means an omitted user_id resolves to the
--    caller instead of failing (or worse, being filled in by a future client
--    bug with the wrong value). The update policies still prevent reassignment.
-- ---------------------------------------------------------------------------
alter table public.subscriptions   alter column user_id set default auth.uid();
alter table public.billing_events  alter column user_id set default auth.uid();
alter table public.notification_records alter column user_id set default auth.uid();

-- Indexes: unchanged. `billing_events_subscription_idx (subscription_id,
-- expected_date desc)` still serves the cascade scan on `subscription_id`, and
-- the referenced side uses the new `subscriptions_id_user_id_key` unique index.
-- No new index is required (audit R-05: index coverage was already correct).
