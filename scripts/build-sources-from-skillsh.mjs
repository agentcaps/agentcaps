#!/usr/bin/env node
// Build a registry sources.yaml from saved skills.sh leaderboard pages.
//
// Input: a directory of JSON files saved from
//   GET https://skills.sh/api/v1/skills?view=all-time&per_page=500&page=N
// (each file is the raw API response with a `data` array). The token never
// touches this script — you fetch the pages, this only reads them off disk.
//
// Output: a sources.yaml with one `git_repository_collection` per GitHub repo,
// `include` globs scoped to exactly the ranked skill folders. skills.sh ranks
// individual skills, but many share one repo, so the top-N collapse to far
// fewer repos.
//
// Usage:
//   node scripts/build-sources-from-skillsh.mjs <pages-dir> [--top 1000] \
//     [--max-per-owner 0] [--out data/registry/sources.generated.yaml]
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const pagesDir = args.find((a) => !a.startsWith('--'));
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const TOP = Number(opt('top', '1000'));
const MAX_PER_OWNER = Number(opt('max-per-owner', '0')); // 0 = no cap
const OUT = opt('out', 'data/registry/sources.generated.yaml');

if (!pagesDir) {
  console.error('Provide the directory of saved skills.sh page JSON files.');
  process.exit(1);
}

// 1. Load + flatten every saved page, preserving leaderboard order.
const files = readdirSync(pagesDir).filter((f) => f.endsWith('.json')).sort();
const seen = new Set();
const skills = [];
for (const file of files) {
  let json;
  try {
    json = JSON.parse(readFileSync(join(pagesDir, file), 'utf8'));
  } catch (e) {
    console.error(`! skipping ${file}: ${e.message}`);
    continue;
  }
  const data = Array.isArray(json) ? json : json.data ?? [];
  for (const s of data) {
    if (s.sourceType && s.sourceType !== 'github') continue; // git-clonable only
    if (s.isDuplicate) continue; // drop forks/copies (skills.sh flags these)
    const source = s.source || (s.id ? s.id.split('/').slice(0, 2).join('/') : null);
    const slug = s.slug || (s.id ? s.id.split('/').slice(2).join('/') : null);
    if (!source || !slug) continue;
    const key = `${source}/${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    skills.push({ source, slug, installs: s.installs ?? 0 });
  }
}

// 2. Keep the top-N by leaderboard order (pages are already install-ranked).
const top = skills.slice(0, TOP);

// 3. Group by repo, optionally capping skills per owner.
const byRepo = new Map();
const ownerCount = new Map();
for (const { source, slug, installs } of top) {
  const owner = source.split('/')[0];
  if (MAX_PER_OWNER > 0) {
    const n = ownerCount.get(owner) ?? 0;
    if (n >= MAX_PER_OWNER) continue;
    ownerCount.set(owner, n + 1);
  }
  if (!byRepo.has(source)) byRepo.set(source, { slugs: new Set(), installs: 0 });
  const entry = byRepo.get(source);
  entry.slugs.add(slug);
  entry.installs += installs;
}

// 4. Emit YAML (hand-rolled — no yaml dep needed). One collection per repo,
//    include globs scoped to the ranked skill folders (+ root SKILL.md catch).
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
const repos = [...byRepo.entries()].sort((a, b) => b[1].installs - a[1].installs);
const lines = ['# Generated from skills.sh all-time leaderboard. Do not hand-edit.', 'sources:'];
let totalSlugs = 0;
for (const [source, { slugs }] of repos) {
  const [owner, repo] = source.split('/');
  const globs = [...slugs].map((s) => `      - "**/${s}/SKILL.md"`);
  globs.push('      - "SKILL.md"'); // single-skill repos with SKILL.md at root
  totalSlugs += slugs.size;
  lines.push(
    `  - slug: ${slugify(`${owner}-${repo}`)}`,
    `    type: git_repository_collection`,
    `    url: https://github.com/${owner}/${repo}`,
    `    include:`,
    ...globs,
    `    curation:`,
    `      category: skill`,
    `      reason: top skills.sh entries by all-time installs`
  );
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');

console.log(`skills loaded:      ${skills.length}`);
console.log(`top-N selected:     ${top.length}`);
console.log(`unique repos:       ${repos.length}`);
console.log(`skill folders:      ${totalSlugs}`);
console.log(`wrote:              ${OUT}`);
console.log('\ntop 15 repos by summed installs:');
for (const [source, { slugs, installs }] of repos.slice(0, 15)) {
  console.log(`  ${installs.toString().padStart(8)}  ${source}  (${slugs.size} skills)`);
}
