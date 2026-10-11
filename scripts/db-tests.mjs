#!/usr/bin/env node
/**
 * Database test runner: applies every migration in supabase/migrations to a
 * disposable Postgres database, then runs the SQL assertions in
 * supabase/tests/*.sql. Any failure exits non-zero, so CI gates on it.
 *
 * Against your own Postgres (docker, or `supabase start`):
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db
 *
 * Throwaway cluster, no docker (installs nothing into package.json):
 *   npm i -D --no-save embedded-postgres && npm run test:db -- --embedded
 *
 * Safety: the runner drops and recreates the `public`/`auth` schemas. It refuses
 * unless the target database looks disposable (name contains "test", or is
 * "postgres"/"template1", or LEAKIFY_DB_ALLOW_DESTRUCTIVE=1). Never point it at
 * real data — use a staging copy for migration dry-runs.
 */
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '..');
const MIGRATIONS_DIR = join(root, 'supabase', 'migrations');
const TESTS_DIR = join(root, 'supabase', 'tests');
const HELPER = join(TESTS_DIR, '00_auth_stub.sql');
const EMBEDDED_PORT = 55432;
const EMBEDDED_DB = 'leakify_test';

const args = process.argv.slice(2);
const wantEmbedded = args.includes('--embedded');
const dbUrlFlag = args.indexOf('--db-url');
if (dbUrlFlag >= 0 && args[dbUrlFlag + 1]) process.env.DATABASE_URL = args[dbUrlFlag + 1];

const listSql = (dir, keep) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && keep(f))
    .sort()
    .map((f) => join(dir, f));

function dsnParts(dsn) {
  const u = new URL(dsn);
  return { database: (u.pathname || '/postgres').replace(/^\//, '') || 'postgres' };
}

function looksDisposable(name) {
  if (process.env.LEAKIFY_DB_ALLOW_DESTRUCTIVE === '1') return true;
  return /test|local|^postgres$|^template1$/i.test(name);
}

async function runFiles(client, files, { commit, label }) {
  let failed = 0;
  for (const file of files) {
    const name = file.replace(`${root}/`, '');
    const sql = readFileSync(file, 'utf8');
    const started = Date.now();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query(commit ? 'commit' : 'rollback');
      console.log(`  ✓ ${name} (${Date.now() - started}ms)`);
    } catch (err) {
      await client.query('rollback').catch(() => {});
      console.error(`  ✖ ${name} (${Date.now() - started}ms)`);
      console.error(`      ${String(err.message).split('\n')[0]}`);
      // Postgres reports a byte offset into the submitted script; turn it into a
      // line number + snippet so a CI failure is actionable without re-running.
      const position = Number(err.position);
      if (Number.isFinite(position) && position > 0) {
        const lines = sql.split('\n');
        const upto = sql.slice(0, position - 1);
        const lineIndex = upto.split('\n').length - 1;
        console.error(`      at ${name}:${lineIndex + 1}`);
        for (let i = Math.max(0, lineIndex - 2); i <= Math.min(lines.length - 1, lineIndex + 1); i += 1) {
          console.error(`      ${String(i + 1).padStart(4)} | ${lines[i]}`);
        }
      }
      failed += 1;
      break; // later files depend on earlier ones
    }
  }
  if (failed === 0) console.log(`  ${label}: ${files.length} file(s) ok`);
  return failed;
}

async function main() {
  const dsn =
    process.env.DATABASE_URL ??
    (wantEmbedded ? `postgres://postgres:postgres@127.0.0.1:${EMBEDDED_PORT}/${EMBEDDED_DB}` : undefined);
  if (!dsn) {
    console.error(
      '✖ No DATABASE_URL. Start Postgres (docker / Supabase local dev) and set it,\n' +
        '  or run: npm run test:db -- --embedded',
    );
    process.exit(1);
  }

  const database = dsnParts(dsn).database;
  if (!looksDisposable(database)) {
    console.error(`✖ refusing to reset schemas in database "${database}" — it does not look disposable.`);
    process.exit(1);
  }

  const { default: pg } = await import('pg');
  const client = new pg.Client(dsn);
  await client.connect();
  const serverVersion = (await client.query('show server_version')).rows[0].server_version;
  console.log(`\nLeakify database tests — ${database} @ Postgres ${serverVersion}\n`);

  try {
    await client.query('drop schema if exists public cascade');
    await client.query('create schema public');
    await client.query('drop schema if exists auth cascade');
    await client.query('grant all on schema public to current_user');

    let failures = await runFiles(
      client,
      [HELPER, ...listSql(MIGRATIONS_DIR, () => true)],
      { commit: true, label: 'setup + migrations' },
    );
    if (failures === 0) {
      failures += await runFiles(client, listSql(TESTS_DIR, (f) => f !== '00_auth_stub.sql'), {
        commit: false,
        label: 'sql assertions',
      });
    }

    await client.end();
    if (failures > 0) {
      console.error('\n✖ Database tests failed.\n');
      process.exit(1);
    }
    console.log('\n✓ Database tests passed: migrations apply cleanly and RLS/ownership assertions hold.\n');
  } catch (err) {
    await client.end().catch(() => {});
    throw err;
  }
}

async function withEmbeddedCluster() {
  let EmbeddedPostgres;
  try {
    // Deliberately an optional install (see the header: no platform binaries in the
    // lockfile), so an unresolved specifier here is expected, not a defect.
    // eslint-disable-next-line import/no-unresolved
    ({ default: EmbeddedPostgres } = await import('embedded-postgres'));
  } catch {
    console.error('✖ `embedded-postgres` is not installed.\n   npm i -D --no-save embedded-postgres');
    process.exit(1);
  }
  // Keep the throwaway cluster out of the repository working tree.
  const dataDir = join(tmpdir(), 'leakify-pg-test');
  rmSync(dataDir, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: EMBEDDED_PORT,
    persistent: false,
    onLog: () => {},
    onNotice: () => {},
    // Shutdown closes the admin client; its late socket error is expected noise.
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.dropDatabase(EMBEDDED_DB).catch(() => {});
  await pg.createDatabase(EMBEDDED_DB);
  try {
    process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${EMBEDDED_PORT}/${EMBEDDED_DB}`;
    await main();
  } finally {
    await pg.stop().catch(() => {});
  }
}

(wantEmbedded ? withEmbeddedCluster() : main()).catch((err) => {
  console.error(`✖ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
