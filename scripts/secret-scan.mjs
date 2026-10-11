#!/usr/bin/env node
/**
 * Baseline secret scan for tracked files (and optionally full git history).
 *
 * This is a *regression net*, not a replacement for provider-side secret
 * scanning: pattern scanners miss obfuscated values. It exists so the
 * repository has an executable check that fails today rather than a setting
 * nobody can verify. Output is limited to file names, line numbers and pattern
 * names — matched values are never printed.
 *
 * Usage:
 *   node scripts/secret-scan.mjs             # tracked files in the worktree
 *   node scripts/secret-scan.mjs --history   # every blob in every commit
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const wantHistory = process.argv.includes('--history');

/** Deliberately narrow, high-signal patterns to keep false positives usable. */
const PATTERNS = [
  ['private-key-block', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY/],
  ['jwt-shaped-token', /\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/],
  ['github-token', /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['aws-access-key-id', /\bAKIA[0-9A-Z]{16}\b/],
  ['stripe-live-key', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/],
  ['openai-style-key', /\bsk-(?:live-|proj-)[A-Za-z0-9]{24,}\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['sendgrid-key', /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/],
  ['npm-token', /\bnpm_[A-Za-z0-9]{30,}\b/],
  ['hardcoded-bearer', /\bBearer\s+[A-Za-z0-9._-]{24,}\b/],
  ['supabase-service-role-mention', /SUPABASE_SERVICE_ROLE[a-z_]*\s*[=:]\s*(?!['"]?<)['"][^'"]{20,}['"]/i],
];

/** Placeholders that must not be reported (docs, env templates, tests). */
const PLACEHOLDER = /(<[a-z_ -]+>|\.{3,}|\*{3,}|\$\{|process\.env|example|placeholder|x{4,}|\[redacted\])/i;

const SKIP_BASENAMES = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock']);
const SKIP_SUFFIX = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.map', '.lock', '.woff', '.woff2'];

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
}

const findings = [];
let scannedFiles = 0;

function scan(label, path, content) {
  const base = path.split('/').pop() ?? path;
  if (SKIP_BASENAMES.has(base) || SKIP_SUFFIX.some((s) => path.endsWith(s))) return;
  scannedFiles += 1;
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.length > 2000) continue; // minified / bundled noise
    for (const [name, re] of PATTERNS) {
      if (re.test(line) && !PLACEHOLDER.test(line)) {
        findings.push({ where: `${label}:${path}:${i + 1}`, pattern: name });
      }
    }
  }
}

if (wantHistory) {
  // "Was a secret ever pushed?" needs every blob, not just HEAD.
  const seenBlobs = new Set();
  const revs = git(['rev-list', '--all']).trim().split('\n').filter(Boolean);
  for (const rev of revs) {
    const listing = git(['ls-tree', '-r', '--long', rev]).trim().split('\n').filter(Boolean);
    for (const entry of listing) {
      const match = /^\S+\s+\S+\s+([0-9a-f]+)\s+\d+\s+(.*)$/.exec(entry);
      if (!match) continue;
      const [, blobSha, path] = match;
      if (seenBlobs.has(blobSha)) continue;
      seenBlobs.add(blobSha);
      let content = '';
      try {
        content = git(['cat-file', '-p', blobSha]);
      } catch {
        continue;
      }
      if (content.includes('\u0000')) continue; // binary
      scan(`history@${rev.slice(0, 8)}`, path, content);
    }
  }
} else {
  for (const file of git(['ls-files']).trim().split('\n').filter(Boolean)) {
    let content = '';
    try {
      content = readFileSync(resolve(root, file), 'utf8');
    } catch {
      continue;
    }
    if (content.includes('\u0000')) continue;
    scan('worktree', file, content);
  }
}

if (findings.length > 0) {
  console.error(`✖ Possible secrets detected in ${findings.length} place(s):`);
  for (const f of findings.slice(0, 50)) console.error(`  ${f.where}  [${f.pattern}]`);
  console.error('\nNever paste the value into a chat, log or this report. Revoke/rotate at the');
  console.error('provider first, then scrub history (git filter-repo) and force-push a clean tree.');
  process.exit(1);
}

console.log(
  `✓ Secret-scan baseline passed — ${scannedFiles} file(s), ${PATTERNS.length} pattern(s), ` +
    `scope: ${wantHistory ? 'tracked files + full history' : 'tracked files'}.`,
);
