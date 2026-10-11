# Supabase database tests

These `.sql` files are the executable proof for two claims the app makes:

1. **Row Level Security is the authorization boundary** — a signed-in user can
   only read/write their own rows in `profiles`, `subscriptions`,
   `billing_events`, `notification_preferences` and `notification_records`
   (`10_rls_isolation.sql`).
2. **Ownership of child rows is enforced by the database** — a billing event or
   notification record cannot point at another user's subscription, and the
   migration preflight refuses to upgrade a dataset that already contains such a
   row (`20_owner_boundary.sql`, added by `0002_owner_bound_child_rows.sql`).

They are also a mutation detector: delete a `with check` clause or drop the
composite foreign key and the run fails.

## Running them

CI (`.github/workflows/ci.yml`, `database` job) uses a `postgres:15` service
container and runs:

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:5432/leakify_test npm run test:db
```

Locally, any disposable Postgres works:

```sh
# Supabase local dev
npm run test:db -- --db-url postgres://postgres:postgres@127.0.0.1:54322/postgres
# or a throwaway cluster with no docker
npm i -D --no-save embedded-postgres
npm run test:db -- --embedded
```

The runner (`scripts/db-tests.mjs`) drops and recreates the `public` and `auth`
schemas in the target database, loads `00_auth_stub.sql`, applies every file in
`supabase/migrations/` in sorted order, then runs each `NN_*.sql` assertion in
its own transaction that is rolled back. It refuses to touch a database whose
name does not look disposable.

### What `00_auth_stub.sql` is

A deliberately small stand-in for the parts of Supabase's managed schema that
our policies call: `auth.users`, `auth.uid()` (reading `request.jwt.claim.sub`),
`auth.role()`, and the `authenticated`/`anon` roles. It is **never** applied by
`supabase db push` — only by this harness. When a migration starts depending on
another Supabase-provided function, stub it here and the tests keep covering the
real policy text.

Because the stub is not byte-identical to Supabase, these tests do not replace a
staging dry-run against the real project (do that before production `db push`).

## Migration checklist

- [ ] Copy staging to a scratch database, or use a dedicated staging project.
- [ ] `node scripts/db-tests.mjs` against that copy first (preflight included).
- [ ] If `0002` aborts with an owner-mismatch count, run the review query:

  ```sql
  select be.id, be.user_id as event_owner, s.user_id as subscription_owner,
         be.expected_date, be.amount_cents, be.currency
  from public.billing_events be
  join public.subscriptions s on s.id = be.subscription_id
  where s.user_id is distinct from be.user_id
  order by be.created_at;
  ```

- [ ] Decide per row: re-attribute to the true owner, or delete the disputed
      row. **Never bulk-update billing history silently** — it is the user's
      record of what they paid. Record who approved each decision.
- [ ] Re-run the migration; then run the full test suite again.
- [ ] Rollback plan for `0002` (it is a single transaction, so a failed run
      leaves the schema unchanged). To reverse a completed run:

  ```sql
  alter table public.billing_events
    drop constraint billing_events_user_subscription_fkey,
    add constraint billing_events_subscription_id_fkey
    foreign key (subscription_id) references public.subscriptions (id) on delete cascade;
  alter table public.notification_records
    drop constraint notification_records_user_subscription_fkey,
    add constraint notification_records_subscription_id_fkey
    foreign key (subscription_id) references public.subscriptions (id) on delete cascade;
  alter table public.subscriptions drop constraint subscriptions_user_id_id_key;
  drop function public.leakify_assert_owner_boundaries();
  ```

  Dropping data is never part of a rollback.
