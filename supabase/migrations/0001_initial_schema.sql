-- Leakify initial database schema (Supabase / Postgres 15+)
-- Run with: supabase db push   (or paste into the SQL editor of a new project)
--
-- Security model: every table has Row Level Security enabled. Users can only
-- read and write rows they own (user_id = auth.uid()). The client uses only
-- the anon key; no service-role privileges exist in the app.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Leakify User',
  preferred_currency char(3) not null default 'USD',
  locale text not null default 'en-US',
  timezone text not null default 'UTC',
  theme_preference text not null default 'system'
    check (theme_preference in ('system', 'light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- Auto-create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'Leakify User'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  provider text,
  category text not null default 'other'
    check (category in ('streaming','music','software','cloud_storage','gaming',
                        'fitness','shopping','utilities','education','other')),
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null,
  interval_every integer not null check (interval_every between 1 and 365),
  interval_unit text not null check (interval_unit in ('day','week','month','year')),
  start_date date,
  next_billing_date date,
  trial_end_date date,
  status text not null default 'active'
    check (status in ('active','trialing','paused','canceled')),
  payment_method_label text,
  cancellation_url text,
  cancellation_notes text,
  notes text,
  reminders jsonb not null default '{"enabled": true, "renewalLeadDays": [3,1,0], "trialLeadDays": [1]}',
  flagged_unused boolean not null default false,
  is_cancel_candidate boolean not null default false,
  canceled_at timestamptz,
  archived_at timestamptz,
  price_history jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trial_after_start check (trial_end_date is null or start_date is null or trial_end_date >= start_date)
);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);
create policy "subscriptions_insert_own" on public.subscriptions
  for insert with check (auth.uid() = user_id);
create policy "subscriptions_update_own" on public.subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "subscriptions_delete_own" on public.subscriptions
  for delete using (auth.uid() = user_id);

-- Common access patterns: list per user, upcoming renewals, per-category reports.
create index if not exists subscriptions_user_created_idx
  on public.subscriptions (user_id, created_at);
create index if not exists subscriptions_user_next_billing_idx
  on public.subscriptions (user_id, next_billing_date)
  where archived_at is null and status in ('active', 'trialing');
create index if not exists subscriptions_user_category_idx
  on public.subscriptions (user_id, category);

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- billing_events — recorded charges (real history, never fabricated)
-- ---------------------------------------------------------------------------
create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  expected_date date not null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency char(3) not null,
  type text not null check (type in ('first_charge', 'renewal', 'trial_end')),
  status text not null default 'expected' check (status in ('expected', 'charged', 'skipped', 'canceled')),
  actual_date date,
  actual_amount_cents bigint,
  created_at timestamptz not null default now()
);

alter table public.billing_events enable row level security;

create policy "billing_events_select_own" on public.billing_events
  for select using (auth.uid() = user_id);
create policy "billing_events_insert_own" on public.billing_events
  for insert with check (auth.uid() = user_id);
create policy "billing_events_update_own" on public.billing_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "billing_events_delete_own" on public.billing_events
  for delete using (auth.uid() = user_id);

create index if not exists billing_events_subscription_idx
  on public.billing_events (subscription_id, expected_date desc);
create index if not exists billing_events_user_date_idx
  on public.billing_events (user_id, expected_date);

-- ---------------------------------------------------------------------------
-- notification_preferences — per-user reminder defaults
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  renewal_lead_days integer[] not null default '{3,1,0}',
  trial_lead_days integer[] not null default '{1}',
  weekly_digest_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_select_own" on public.notification_preferences
  for select using (auth.uid() = user_id);
create policy "notification_preferences_insert_own" on public.notification_preferences
  for insert with check (auth.uid() = user_id);
create policy "notification_preferences_update_own" on public.notification_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notification_preferences_delete_own" on public.notification_preferences
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- notification_records — dedup bookkeeping for scheduled/delivered reminders.
-- (Local notifications are scheduled on-device; this table optionally mirrors
-- records for cloud-aware clients. All rows carry a stable dedup key.)
-- ---------------------------------------------------------------------------
create table if not exists public.notification_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete cascade,
  dedup_key text not null,
  type text not null check (type in ('renewal', 'trial', 'weekly_digest')),
  occurrence_date date,
  lead_days integer not null default 0,
  status text not null default 'scheduled' check (status in ('scheduled', 'delivered', 'canceled')),
  created_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);

alter table public.notification_records enable row level security;

create policy "notification_records_select_own" on public.notification_records
  for select using (auth.uid() = user_id);
create policy "notification_records_insert_own" on public.notification_records
  for insert with check (auth.uid() = user_id);
create policy "notification_records_update_own" on public.notification_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notification_records_delete_own" on public.notification_records
  for delete using (auth.uid() = user_id);

create index if not exists notification_records_user_idx
  on public.notification_records (user_id, created_at desc);
