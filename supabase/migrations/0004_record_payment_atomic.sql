-- Atomic, idempotent payment recording.
--
-- Problem: `recordPayment()` used two separate round-trips (insert the billing
-- event, then update the subscription's next billing date). A failure between
-- them left charge history and schedule disagreeing — the one thing a
-- subscription tracker must not do silently.
--
-- This migration moves both writes into one database transaction and adds a
-- replay guard (`client_request_id`), so a retried request can never produce a
-- duplicate charge.
--
-- Deliberate boundary: the *next* billing date is computed in TypeScript
-- (`lib/dates.addInterval`, anchor-based, month-end safe, unit tested) and passed
-- in. Re-implementing recurrence in SQL would create a second source of truth
-- for money/date math — the exact drift bug this app was built to avoid. The
-- database still enforces the invariant that matters (the new date must be after
-- the stored one) and that the row belongs to the caller.

-- Replay key for client-initiated writes. Nullable: rows created by other paths
-- (imports, older clients) simply do not participate in dedup.
alter table public.billing_events
  add column if not exists client_request_id uuid;

create unique index if not exists billing_events_user_request_uidx
  on public.billing_events (user_id, client_request_id)
  where client_request_id is not null;

create or replace function public.record_payment(
  p_subscription_id uuid,
  p_actual_date date,
  p_actual_amount_cents bigint,
  p_next_billing_date date,
  p_client_request_id uuid default null
)
returns public.subscriptions
language plpgsql
-- SECURITY INVOKER + RLS: the function can only ever touch the caller's rows.
-- Failures use stable `leakify:*` message prefixes (default PL/pgSQL SQLSTATE
-- P0001), which the client maps; a custom errcode would collide with PL/pgSQL's
-- own condition names and make the exception uncatchable by name.
security invoker
set search_path = public, pg_temp
as $$
declare
  s public.subscriptions;
  replay public.billing_events;
begin
  -- Lock the subscription for the duration of the transaction so two concurrent
  -- recordings cannot both see the same expected date.
  select * into s
  from public.subscriptions
  where id = p_subscription_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'leakify:not_found';
  end if;

  if s.next_billing_date is null then
    raise exception 'leakify:no_next_billing_date';
  end if;

  if p_actual_date is null then
    raise exception 'leakify:missing_actual_date';
  end if;

  if p_actual_amount_cents is null or p_actual_amount_cents < 0 then
    raise exception 'leakify:invalid_amount';
  end if;

  if p_next_billing_date is null or p_next_billing_date <= s.next_billing_date then
    -- The client's interval math must move the schedule forward; refusing to
    -- rewind is what stops a replayed or miscalculated request from corrupting
    -- the upcoming total.
    raise exception 'leakify:invalid_next_billing_date';
  end if;

  -- Idempotent replay: the same request id has already been recorded, so return
  -- the current state without inserting a second event or rolling twice.
  if p_client_request_id is not null then
    select * into replay
    from public.billing_events
    where user_id = auth.uid()
      and client_request_id = p_client_request_id
    limit 1;

    if found then
      select * into s from public.subscriptions where id = p_subscription_id;
      return s;
    end if;
  end if;

  insert into public.billing_events (
    subscription_id, user_id, expected_date, amount_cents, currency,
    type, status, actual_date, actual_amount_cents, client_request_id
  )
  values (
    s.id, s.user_id, s.next_billing_date, s.amount_cents, s.currency,
    case when s.status = 'trialing' then 'trial_end' else 'renewal' end,
    'charged', p_actual_date, p_actual_amount_cents, p_client_request_id
  );

  -- The alias matters: a bare `status` here would be ambiguous between the
  -- column and the composite record's field in PL/pgSQL.
  update public.subscriptions sub
     set next_billing_date = p_next_billing_date,
         status = case when s.status = 'trialing' then 'active' else sub.status end,
         updated_at = now()
   where sub.id = s.id
  returning * into s;

  return s;
end;
$$;

comment on function public.record_payment is
  'Atomically records one charge and rolls the subscription schedule forward. Idempotent per client_request_id.';

-- Execution is a per-user action, not a public one.
revoke all on function public.record_payment(uuid, date, bigint, date, uuid) from public;
grant execute on function public.record_payment(uuid, date, bigint, date, uuid) to authenticated;
