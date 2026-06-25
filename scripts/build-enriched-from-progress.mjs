#!/usr/bin/env node
// Build sources.enriched.yaml from the progress JSONL file (partial results).
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROGRESS_FILE = join(ROOT, 'data/registry/sources.enriched.yaml.progress.jsonl');
const OUT_FILE = join(ROOT, 'data/registry/sources.enriched.yaml');

const lines = readFileSync(PROGRESS_FILE, 'utf8').split('\n').filter(Boolean);
const ok = [];
for (const line of lines) {
  try {
    const r = JSON.parse(line);
    if (r.status === 'ok' && r.ard) ok.push(r);
  } catch {}
}

const entries = ok.map((r) => ({
  slug: r.slug,
  type: 'git_repository',
  url: r.repoUrl,
  path: r.path,
  curation: {
    category: r.ard.category,
    reason: 'skills.sh top-1000, ARD-enriched',
    catalogEntry: {
      tags: r.ard.tags,
      capabilities: r.ard.capabilities,
      representativeQueries: r.ard.representativeQueries,
    },
  },
}));

const yaml = YAML.stringify(
  { sources: entries },
  { lineWidth: 120, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' }
);

writeFileSync(OUT_FILE, `# Enriched from skills.sh — partial results from progress file.\n${yaml}`);
process.stderr.write(`[done] Wrote ${entries.length} entries to ${OUT_FILE}\n`);
