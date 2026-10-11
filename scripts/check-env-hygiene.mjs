#!/usr/bin/env node
/**
 * Environment-file hygiene check (runs in CI, exit 1 on a regression).
 *
 * Two guarantees it protects:
 *  1. every real `.env*` filename is ignored by git, so a local file holding
 *     keys can never be staged by `git add -A`;
 *  2. `.env.example` stays tracked, so setup docs keep working.
 *
 * It deliberately prints only file *names* — never contents.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const MUST_BE_IGNORED = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.production.local',
  '.env.development',
  '.env.test',
  '.env.staging',
  '.env.example.local',
];

let failed = false;
const fail = (msg) => {
  failed = true;
  console.error(`✖ ${msg}`);
};

for (const file of MUST_BE_IGNORED) {
  // Exit status 0 means at least one ignore rule matched this pathname.
  let ignored = true;
  try {
    execFileSync('git', ['check-ignore', file], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    ignored = false;
  }
  if (!ignored) fail(`${file} is NOT ignored by .gitignore`);
}

// A tracked .env file with real content is the incident this check prevents.
const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);
const trackedEnv = tracked.filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example'));
if (trackedEnv.length > 0) {
  fail(`tracked env file(s) found: ${trackedEnv.join(', ')} — remove them from git and rotate any real values`);
}

if (!tracked.includes('.env.example')) {
  fail('.env.example is not tracked — setup documentation would lose its template');
} else {
  const example = readFileSync(resolve(root, '.env.example'), 'utf8');
  // Example files must stay empty of real values: a non-empty assignment to a
  // secret-shaped key is worth a human look.
  const suspicious = example
    .split('\n')
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => /^[A-Z0-9_]*(KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*=\S/.test(line.trim()));
  if (suspicious.length > 0) {
    fail(`.env.example line(s) ${suspicious.map((s) => s.i + 1).join(', ')} look like real values, not placeholders`);
  }
}

if (existsSync(resolve(root, '.env'))) {
  console.log('ℹ a local .env exists in the working tree (untracked, as intended)');
}

if (failed) {
  console.error('\nEnv-hygiene check failed. Fix .gitignore and untrack any committed env file.');
  process.exit(1);
}
console.log('✓ Env-hygiene check passed: all .env* variants ignored, .env.example tracked.');
