#!/usr/bin/env node
/**
 * Jest launcher.
 *
 * supabase/tests runs the project's real SQL migrations inside PGlite (Postgres
 * compiled to WASM). PGlite loads its Node builtins with a dynamic `import()`,
 * which Jest's CommonJS VM refuses unless Node is started with
 * `--experimental-vm-modules`. A launcher keeps that working on every platform
 * (a bare `NODE_OPTIONS=... jest` in package.json does not work on Windows).
 *
 * All CLI arguments are forwarded: `npm test -- --ci supabase/tests`.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const jestBin = require.resolve('jest/bin/jest');

const result = spawnSync(
  process.execPath,
  ['--experimental-vm-modules', jestBin, ...process.argv.slice(2)],
  { stdio: 'inherit', env: process.env },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
