/**
 * Test harness that runs the REAL migrations against a real Postgres engine
 * (PGlite — Postgres compiled to WASM), so RLS policies and foreign-key
 * constraints are verified by executing them rather than by reading them.
 *
 * Why not a live Supabase project? Because then the suite only runs when
 * someone remembers to. This runs in `npm test`, in CI, with no Docker, no
 * network and no credentials.
 *
 * What is stubbed (and why that is faithful):
 * - `auth.users` — the harness creates a minimal stand-in with the columns the
 *   migrations touch. The real table is owned by GoTrue.
 * - `auth.uid()` — reimplemented exactly as Supabase defines it:
 *   `current_setting('request.jwt.claims')::json->>'sub'`.
 * - The `pgcrypto` extension — PGlite does not bundle it. The line is stripped
 *   (and asserted to be the only line stripped); `gen_random_uuid()` has been
 *   core Postgres since 13, so nothing else in the schema needs it.
 */
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

/** Remove the one statement PGlite cannot run; refuse anything unexpected. */
export function migrationSqlForTest(sql: string): string {
  const kept: string[] = [];
  for (const line of sql.split('\n')) {
    if (/^\s*create extension/i.test(line)) {
      if (!/pgcrypto/i.test(line)) {
        throw new Error(`Unexpected extension in migration, harness needs updating: ${line}`);
      }
      continue; // gen_random_uuid() is core Postgres >= 13
    }
    kept.push(line);
  }
  return kept.join('\n');
}

export function migrationFiles(upTo?: string): { name: string; sql: string }[] {
  const names = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return names
    .filter((name) => (upTo ? name <= upTo : true))
    .map((name) => ({
      name,
      sql: migrationSqlForTest(readFileSync(join(MIGRATIONS_DIR, name), 'utf8')),
    }));
}

export interface TestDatabase {
  /** Run a callback as `authenticated` with the given user id in the JWT claims. */
  asUser<T>(userId: string | null, fn: (tx: Transaction) => Promise<T>): Promise<T>;
  /** Run a callback as the table owner (no RLS), for setup and assertions. */
  asOwner<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
  appliedMigrations: string[];
}

/**
 * Boot an in-memory Postgres with Supabase's auth surface, then apply the
 * project's migrations in filename order.
 *
 * @param upTo apply only migrations whose filename sorts at or before this
 *   name — used to prove a test actually catches what a later migration fixes.
 */
export async function createTestDatabase(upTo?: string): Promise<TestDatabase> {
  const db = new PGlite();

  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key,
      email text unique,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    -- Exactly Supabase's definition: the subject claim of the request JWT.
    create or replace function auth.uid() returns uuid
      language sql stable as $$
        select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
      $$;
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    end $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);

  const applied: string[] = [];
  for (const migration of migrationFiles(upTo)) {
    await db.exec(migration.sql);
    applied.push(migration.name);
  }

  // What a fresh Supabase project grants by default on the public schema.
  await db.exec(`
    grant usage on schema public to anon, authenticated;
    grant all on all tables in schema public to anon, authenticated;
    grant all on all sequences in schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
  `);

  return {
    appliedMigrations: applied,
    async asUser(userId, fn) {
      return db.transaction(async (tx) => {
        await tx.exec('set local role authenticated');
        await tx.query('select set_config($1, $2, true)', [
          'request.jwt.claims',
          JSON.stringify(userId ? { sub: userId, role: 'authenticated' } : { role: 'anon' }),
        ]);
        return fn(tx);
      });
    },
    async asOwner(fn) {
      return db.transaction(async (tx) => fn(tx));
    },
    async query(sql, params) {
      const result = params ? await db.query(sql, params as never[]) : await db.query(sql);
      return result.rows as never as Record<string, unknown>[] as never;
    },
    async exec(sql) {
      await db.exec(sql);
    },
    async close() {
      await db.close();
    },
  };
}

/** Insert both test users as the owner (GoTrue's job in production). */
export async function seedUsers(db: TestDatabase): Promise<void> {
  await db.exec(`
    insert into auth.users (id, email) values
      ('${USER_A}', 'ana@example.test'),
      ('${USER_B}', 'bo@example.test')
    on conflict (id) do nothing;
  `);
}

/** A minimal valid subscription row for `userId`. Returns the new id. */
export async function insertSubscription(
  tx: Transaction,
  userId: string,
  name: string,
): Promise<string> {
  const result = await tx.query<{ id: string }>(
    `insert into public.subscriptions
       (name, user_id, amount_cents, currency, interval_every, interval_unit, next_billing_date, status)
     values ($1, $2, 1599, 'USD', 1, 'month', '2026-11-01', 'active')
     returning id`,
    [name, userId],
  );
  return result.rows[0].id;
}

/** Postgres SQLSTATE for a Row Level Security violation. */
export const RLS_VIOLATION = '42501';
/** Postgres SQLSTATE for a foreign-key violation. */
export const FK_VIOLATION = '23503';
