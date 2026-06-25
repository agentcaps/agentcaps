#!/usr/bin/env node
/**
 * Enrichment pipeline: sources.generated.yaml → sources.enriched.yaml
 *
 * For each skill in sources.generated.yaml:
 *   1. Resolve GitHub raw URL from the include glob
 *   2. Fetch SKILL.md content
 *   3. Call `claude -p` to generate ARD fields (tags, capabilities, queries)
 *   4. Emit individual git_repository entries with curation.catalogEntry
 *
 * Usage:
 *   node scripts/enrich-from-skillsh.mjs [--sample N] [--concurrency N] [--resume] [--out <file>]
 */

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (flag, def) => { const i = args.indexOf(flag); return i !== -1 && args[i + 1] ? args[i + 1] : def; };
const hasFlag = (flag) => args.includes(flag);

const SAMPLE = parseInt(getArg('--sample', '0'), 10);
const CONCURRENCY = parseInt(getArg('--concurrency', '5'), 10);
const OUT_FILE = join(ROOT, getArg('--out', 'data/registry/sources.enriched.yaml'));
const RESUME = hasFlag('--resume');
const PROGRESS_FILE = OUT_FILE + '.progress.jsonl';

// ── helpers ──────────────────────────────────────────────────────────────────

function subDirFromGlob(glob) {
  const m = glob.match(/\*\*\/([^/]+)\/[^/]+$/);
  return m ? m[1] : null;
}

function makeSlug(repoSlug, subDir) {
  if (!subDir) return repoSlug;
  return `${repoSlug}-${subDir}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

function parseGitHubUrl(url) {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

async function fetchGitHubRaw(owner, repo, filePath) {
  for (const branch of ['main', 'master']) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (res.ok) return await res.text();
    } catch {}
  }
  return null;
}

async function resolveSkillPath(owner, repo, glob) {
  const subDir = subDirFromGlob(glob);
  if (!subDir) {
    const content = await fetchGitHubRaw(owner, repo, 'SKILL.md');
    return content ? { path: 'SKILL.md', content } : null;
  }
  const candidates = [
    `${subDir}/SKILL.md`,
    `skills/${subDir}/SKILL.md`,
    `skill/${subDir}/SKILL.md`,
    `${subDir}/Skill.md`,
  ];
  for (const p of candidates) {
    const content = await fetchGitHubRaw(owner, repo, p);
    if (content) return { path: p, content };
  }
  return null;
}

// Run claude -p as a spawned child process (non-blocking, respects concurrency)
function generateARD(skillContent, repoUrl, skillPath) {
  return new Promise((resolve) => {
    const snippet = skillContent.slice(0, 3000);
    const prompt = `You are an ARD metadata generator for agent SKILL.md files.

Generate JSON for the AgentCaps registry from this SKILL.md:
- tags: 3-6 lowercase kebab-case tags
- capabilities: 3-6 dot-notation IDs like "domain.verb" (e.g. "image.generate", "code.review")
- representativeQueries: 3-5 natural user queries (each >=12 chars)
- category: one of: productivity, browser, development, analysis, social, memory, model, presentation, security, media, data, communication, writing

Source: ${repoUrl}/${skillPath}

Content:
${snippet}

Reply with ONLY valid JSON (no markdown fences):
{"tags":[],"capabilities":[],"representativeQueries":[],"category":""}`;

    const child = spawn('claude', ['-p', prompt, '--model', 'claude-haiku-4-5-20251001'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 90000,
    });

    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });

    child.on('close', (code) => {
      try {
        const jsonMatch = out.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error(`No JSON (exit ${code}): ${out.slice(0, 100)}`);
        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed.tags) || !Array.isArray(parsed.capabilities)) {
          throw new Error('Invalid ARD shape');
        }
        resolve(parsed);
      } catch (e) {
        process.stderr.write(`  [ard-err] ${String(e.message).slice(0, 120)}\n`);
        resolve(null);
      }
    });

    child.on('error', (e) => {
      process.stderr.write(`  [spawn-err] ${e.message}\n`);
      resolve(null);
    });
  });
}

async function processSkill(skill) {
  try {
    const resolved = await resolveSkillPath(skill.owner, skill.repo, skill.glob);
    if (!resolved) {
      process.stderr.write(`[skip:404] ${skill.slug}\n`);
      return { ...skill, status: 'not_found' };
    }
    const ard = await generateARD(resolved.content, skill.repoUrl, resolved.path);
    if (!ard) {
      process.stderr.write(`[skip:ard] ${skill.slug}\n`);
      return { ...skill, status: 'ard_failed', path: resolved.path };
    }
    process.stderr.write(`[ok] ${skill.slug} → ${ard.category} [${ard.tags.slice(0, 3).join(', ')}]\n`);
    return { ...skill, status: 'ok', path: resolved.path, ard };
  } catch (err) {
    process.stderr.write(`[err] ${skill.slug}: ${err.message}\n`);
    return { ...skill, status: 'error', error: err.message };
  }
}

// Pool-based concurrency: keeps CONCURRENCY tasks running at all times
async function pool(items, fn, concurrency) {
  const results = new Array(items.length);
  let nextIdx = 0;
  let done = 0;

  async function worker() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await fn(items[idx]);
      done++;
      if (done % 10 === 0 || done === items.length) {
        const ok = results.slice(0, done).filter(Boolean).filter((r) => r.status === 'ok').length;
        process.stderr.write(`[progress] ${done}/${items.length} (ok: ${ok})\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const generatedPath = join(ROOT, 'data/registry/sources.generated.yaml');
  const generated = YAML.parse(readFileSync(generatedPath, 'utf8'));

  const doneSet = new Set();
  if (RESUME && existsSync(PROGRESS_FILE)) {
    for (const line of readFileSync(PROGRESS_FILE, 'utf8').split('\n').filter(Boolean)) {
      try { doneSet.add(JSON.parse(line).slug); } catch {}
    }
    process.stderr.write(`[resume] Already enriched: ${doneSet.size} skills\n`);
  }

  const allSkills = [];
  for (const source of generated.sources) {
    const gh = parseGitHubUrl(source.url);
    if (!gh) continue;
    for (const glob of (source.include ?? ['SKILL.md'])) {
      const subDir = subDirFromGlob(glob);
      allSkills.push({
        slug: makeSlug(source.slug, subDir),
        repoSlug: source.slug,
        repoUrl: source.url,
        owner: gh.owner,
        repo: gh.repo,
        glob,
        subDir,
      });
    }
  }

  process.stderr.write(`[enrich] Total skills: ${allSkills.length}\n`);

  const pending = allSkills.filter((s) => !doneSet.has(s.slug));
  const toProcess = SAMPLE > 0 ? pending.slice(0, SAMPLE) : pending;
  process.stderr.write(`[enrich] Processing: ${toProcess.length}${SAMPLE ? ` (sample of ${SAMPLE})` : ''} at concurrency ${CONCURRENCY}\n`);

  if (toProcess.length === 0) {
    process.stderr.write('[enrich] Nothing to do.\n');
    process.exit(0);
  }

  // Open progress file for appending
  const wrappedFn = async (skill) => {
    const result = await processSkill(skill);
    appendFileSync(PROGRESS_FILE, JSON.stringify(result) + '\n');
    return result;
  };

  const results = await pool(toProcess, wrappedFn, CONCURRENCY);
  const ok = results.filter((r) => r && r.status === 'ok');
  process.stderr.write(`\n[enrich] Results: ${ok.length} ok, ${results.length - ok.length} skipped/failed\n`);

  // Merge with existing if resuming
  const existingEntries = [];
  if (RESUME && existsSync(OUT_FILE)) {
    try {
      const existing = YAML.parse(readFileSync(OUT_FILE, 'utf8'));
      existingEntries.push(...(existing.sources ?? []));
    } catch {}
  }
  const existingSlugs = new Set(existingEntries.map((e) => e.slug));

  const newEntries = ok
    .filter((r) => !existingSlugs.has(r.slug))
    .map((r) => ({
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

  const allEntries = [...existingEntries, ...newEntries];
  const yaml = YAML.stringify(
    { sources: allEntries },
    { lineWidth: 120, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' }
  );

  writeFileSync(OUT_FILE, `# Enriched from skills.sh — generated by enrich-from-skillsh.mjs. Do not hand-edit.\n${yaml}`);
  process.stderr.write(`[done] Wrote ${allEntries.length} entries to ${OUT_FILE}\n`);

  process.stdout.write(JSON.stringify({
    total: allSkills.length,
    processed: toProcess.length,
    ok: ok.length,
    failed: results.filter((r) => r && r.status !== 'ok').length,
    output: OUT_FILE,
  }) + '\n');
}

main().catch((err) => {
  process.stderr.write(`[fatal] ${err.message}\n`);
  process.exit(1);
});
