-- Test-harness scaffold: a minimal stand-in for the parts of Supabase's managed
-- schema that Leakify's policies depend on. This file is ONLY loaded by the
-- local/CI Postgres test runner (npm run test:db) — never by `supabase db push`.
--
-- If these stubs ever stop matching Supabase, the RLS tests become meaningless,
-- so they are kept deliberately small and named after the real API surface:
--   auth.users, auth.uid(), auth.role(), and the `authenticated` role.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Supabase exposes the JWT subject through this GUC for the `authenticated`
-- role; tests switch identity by setting it inside a transaction.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object('sub', auth.uid()::text, 'role', auth.role())
$$;

-- App-facing role. Tables are created by the superuser (as Supabase does), and
-- RLS is what limits rows: `authenticated` must never own the tables here.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end;
$$;

grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;

-- Supabase grants table privileges and lets RLS decide row visibility. Both
-- roles get SELECT so the anon test measures RLS rather than table ACLs.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, anon;
alter default privileges in schema public
  grant execute on functions to authenticated, anon;
