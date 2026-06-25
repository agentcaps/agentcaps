#!/usr/bin/env node
/**
 * Merge sources.yaml + sources.enriched.yaml → sources.yaml
 *
 * Hand-curated entries in sources.yaml take precedence.
 * Enriched entries are appended for slugs not already present.
 *
 * Usage:
 *   node scripts/merge-enriched-sources.mjs [--dry-run] [--out data/registry/sources.yaml]
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const OUT = join(ROOT, args[args.indexOf('--out') + 1] ?? 'data/registry/sources.yaml');

const curatedPath = join(ROOT, 'data/registry/sources.yaml');
const enrichedPath = join(ROOT, 'data/registry/sources.enriched.yaml');

const curated = YAML.parse(readFileSync(curatedPath, 'utf8'));
const enriched = YAML.parse(readFileSync(enrichedPath, 'utf8'));

const curatedSlugs = new Set((curated.sources ?? []).map((s) => s.slug));

const toAdd = (enriched.sources ?? []).filter((s) => !curatedSlugs.has(s.slug));

console.error(`[merge] Curated: ${curated.sources.length}, Enriched: ${enriched.sources.length}, New: ${toAdd.length}`);

const merged = {
  sources: [...curated.sources, ...toAdd],
};

const yaml = YAML.stringify(merged, {
  lineWidth: 120,
  defaultStringType: 'QUOTE_DOUBLE',
  defaultKeyType: 'PLAIN',
});

const header = `# AgentCaps public registry sources.\n# Hand-curated entries first; enriched entries below.\n`;

if (DRY_RUN) {
  console.error(`[dry-run] Would write ${merged.sources.length} entries to ${OUT}`);
  console.log(yaml.slice(0, 500) + '\n...(truncated)');
} else {
  writeFileSync(OUT, header + yaml);
  console.error(`[done] Wrote ${merged.sources.length} entries to ${OUT}`);
}
