-- Leakify owner-boundary hardening.
--
-- Why: `billing_events` and `notification_records` already carry a `user_id`
-- and RLS restricts every table to `auth.uid()`. But neither relation proved
-- that the child row's owner is the owner of the subscription it points at, so
-- a buggy or compromised client that passed RLS could link user A's billing
-- history to user B's subscription (and cascade-delete or read across that
-- link if B's rows were later touched).
--
-- This migration makes the invariant "a child row belongs to the same user as
-- its parent subscription" a database constraint, not a convention.
--
-- Apply to a staging/disposable copy FIRST: the preflight below intentionally
-- aborts when existing data violates the invariant, rather than silently
-- reassigning or deleting billing history.

begin;

-- ---------------------------------------------------------------------------
-- 1. Preflight: refuse to change constraints over inconsistent history.
--    Never auto-"fix" money history; a human decides who owns a disputed row.
-- ---------------------------------------------------------------------------
create or replace function public.leakify_assert_owner_boundaries()
returns void
language plpgsql
stable
as $$
declare
  billing_mismatch integer;
  notify_mismatch integer;
begin
  select count(*) into billing_mismatch
  from public.billing_events be
  join public.subscriptions s on s.id = be.subscription_id
  where s.user_id is distinct from be.user_id;

  if billing_mismatch > 0 then
    raise exception
      'owner-boundary preflight: % billing_events row(s) whose user_id differs from their subscription owner; review and repair them (see supabase/tests/README.md) before re-running',
      billing_mismatch;
  end if;

  select count(*) into notify_mismatch
  from public.notification_records nr
  join public.subscriptions s on s.id = nr.subscription_id
  where nr.subscription_id is not null
    and s.user_id is distinct from nr.user_id;

  if notify_mismatch > 0 then
    raise exception
      'owner-boundary preflight: % notification_records row(s) whose user_id differs from their subscription owner; review and repair them before re-running',
      notify_mismatch;
  end if;
end;
$$;

select public.leakify_assert_owner_boundaries();

-- ---------------------------------------------------------------------------
-- 2. A composite FK target: (user_id, id) must be unique before it can be
--    referenced. id alone stays the primary key.
-- ---------------------------------------------------------------------------
alter table public.subscriptions
  add constraint subscriptions_user_id_id_key unique (user_id, id);

-- ---------------------------------------------------------------------------
-- 3. Owner-bound foreign keys. ON DELETE CASCADE is preserved: deleting a
--    subscription still removes its own history, but only within one owner.
--    notification_records.subscription_id stays nullable (weekly digests are
--    not tied to a subscription), and a NULL in a MATCH SIMPLE foreign key is
--    simply not enforced — which is the behavior digests need.
-- ---------------------------------------------------------------------------
alter table public.billing_events
  drop constraint billing_events_subscription_id_fkey;

alter table public.billing_events
  add constraint billing_events_user_subscription_fkey
  foreign key (user_id, subscription_id)
  references public.subscriptions (user_id, id)
  on delete cascade;

alter table public.notification_records
  drop constraint notification_records_subscription_id_fkey;

alter table public.notification_records
  add constraint notification_records_user_subscription_fkey
  foreign key (user_id, subscription_id)
  references public.subscriptions (user_id, id)
  on delete cascade;

-- ---------------------------------------------------------------------------
-- 4. Keep the guard available for staging runs and CI (it is cheap: two joins
--    over indexed columns) without granting it to app roles.
-- ---------------------------------------------------------------------------
revoke all on function public.leakify_assert_owner_boundaries() from public;

comment on constraint billing_events_user_subscription_fkey on public.billing_events is
  'Owner boundary: billing history must belong to the same user that owns the subscription.';
comment on constraint notification_records_user_subscription_fkey on public.notification_records is
  'Owner boundary: notification bookkeeping must belong to the same user that owns the subscription (NULL subscription_id = digest rows are exempt).';

select public.leakify_assert_owner_boundaries();

commit;
