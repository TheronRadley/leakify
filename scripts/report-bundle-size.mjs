#!/usr/bin/env node
/**
 * Bundle-size baseline for `npx expo export` output (reporting only).
 *
 * Purpose: make performance work measurable instead of vibes-based. CI prints
 * the largest exported chunks and stores them as an artifact; thresholds are
 * only worth adding once a distribution of real builds exists (see the
 * performance item in the audit checklist).
 *
 * Usage: node scripts/report-bundle-size.mjs [distDir]
 */
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const distDir = resolve(root, process.argv[2] ?? 'dist');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(js|css)$/.test(entry)) out.push({ file: full, size: st.size });
  }
  return out;
}

let files;
try {
  files = walk(distDir);
} catch {
  console.error(`✖ No export directory at ${distDir}. Run \`npx expo export --platform web\` first.`);
  process.exit(1);
}

const rows = files
  .map(({ file, size }) => ({
    file: file.replace(`${distDir}/`, ''),
    rawKB: size / 1024,
    gzipKB: gzipSync(readFileSync(file), { level: 6 }).length / 1024,
  }))
  .sort((a, b) => b.rawKB - a.rawKB)
  .slice(0, 12);

if (rows.length === 0) {
  console.error(`✖ ${distDir} contains no .js/.css chunks.`);
  process.exit(1);
}

const totalRaw = files.reduce((sum, f) => sum + f.size, 0);
console.log(`Bundle baseline for ${distDir.replace(`${root}/`, '')} (${files.length} chunks, ` +
  `${(totalRaw / 1024).toFixed(0)} KB raw total):\n`);
console.table(
  rows.map((r) => ({
    chunk: r.file,
    'raw KB': r.rawKB.toFixed(0),
    'gzip KB': r.gzipKB.toFixed(0),
  })),
);
console.log('\nℹ Reporting only — add a threshold once CI has a history of comparable builds.');

try {
  execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, stdio: 'ignore' });
} catch {
  /* not a git checkout — fine */
}
