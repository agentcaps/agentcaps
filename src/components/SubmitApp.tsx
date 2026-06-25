import { useState } from 'preact/hooks';
import { Button, KV, Notice, Score, Tag, ValidationFinding } from '@agentcaps/ui';

type Stage = 'input' | 'parsing' | 'preview' | 'publishing' | 'submitted';

interface Finding { severity: 'error' | 'warning' | 'info'; code: string; message: string }
interface Entry {
  name: string;
  category: string;
  score: number;
  description: string;
  tags: string[];
  capabilities: string[];
  queries: string[];
  findings: Finding[];
  source: { path: string; commit: string; indexed: string };
}

const CAT_WORDS: Record<string, string[]> = {
  design: ['design', 'ui', 'slides', 'slide', 'frontend', 'brand', 'canvas', 'figma'],
  data: ['data', 'sql', 'db', 'excel', 'xlsx', 'csv', 'analytics', 'pandas'],
  web: ['web', 'browser', 'scrape', 'http', 'fetch', 'crawl', 'puppeteer'],
  code: ['code', 'repo', 'git', 'test', 'lint', 'review', 'refactor'],
  docs: ['docs', 'doc', 'docx', 'pdf', 'markdown', 'notion', 'writing'],
  ops: ['ops', 'deploy', 'ci', 'cloud', 'azure', 'aws', 'kube', 'docker']
};

const EXAMPLES = ['anthropics/skills/tree/main/skills/pdf', 'vercel-labs/skills', 'obra/superpowers'];

// Prototype heuristic — production must parse the real SKILL.md frontmatter and
// compute the metadata-quality score + findings server-side.
function parseUrl(raw: string): Entry {
  const clean = raw.replace(/^https?:\/\//, '').replace(/^github\.com\//, '').replace(/\/+$/, '');
  const seg = clean.split('/').filter(Boolean);
  let slug = (seg[seg.length - 1] || 'skill').replace(/skill\.md$/i, '').replace(/\.md$/i, '');
  slug = slug.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'skill';
  const words = slug.split('-').filter(Boolean);
  let category = 'general';
  for (const [cat, kws] of Object.entries(CAT_WORDS)) {
    if (words.some((w) => kws.includes(w))) { category = cat; break; }
  }
  const cap = (w: string) => `${category}.${w}`;
  return {
    name: slug,
    category,
    score: 78,
    description: `Imported from github.com/${seg.slice(0, 2).join('/') || clean}. ${words.join(' ')} capability generated from the source SKILL.md.`,
    tags: [...new Set([category, ...words])].slice(0, 6),
    capabilities: words.slice(0, 4).map(cap),
    queries: [
      `use ${slug.replace(/-/g, ' ')} from an agent`,
      `when should I reach for the ${words[0] ?? slug} skill`
    ],
    findings: [
      { severity: 'info', code: 'trust-manifest', message: 'TrustManifest not supplied; this is informational and not a safety score.' },
      { severity: 'warning', code: 'representative-queries', message: 'Provide 2-5 representative queries for better ARD search quality.' }
    ],
    source: { path: 'SKILL.md', commit: '—', indexed: new Date().toISOString().slice(0, 10) }
  };
}

const STEPS = ['Paste source', 'Review entry', 'Publish'];

function stepIndex(stage: Stage): number {
  if (stage === 'input' || stage === 'parsing') return 0;
  if (stage === 'preview' || stage === 'publishing') return 1;
  return 2;
}

export default function SubmitApp() {
  const [stage, setStage] = useState<Stage>('input');
  const [url, setUrl] = useState('');
  const [entry, setEntry] = useState<Entry | null>(null);

  const current = stepIndex(stage);

  function parse() {
    if (!url.trim()) return;
    setStage('parsing');
    setTimeout(() => { setEntry(parseUrl(url)); setStage('preview'); }, 900);
  }
  function publish() {
    setStage('publishing');
    setTimeout(() => {
      try {
        if (entry) {
          const prev = JSON.parse(localStorage.getItem('agentcaps_submitted') || '[]');
          localStorage.setItem('agentcaps_submitted', JSON.stringify([...prev, entry]));
        }
      } catch { /* demo persistence only */ }
      setStage('submitted');
    }, 900);
  }
  function reset() { setUrl(''); setEntry(null); setStage('input'); }

  return (
    <div class="submit-wrap">
      <ol class="stepper" aria-label="Submit progress">
        {STEPS.map((label, i) => (
          <li key={label} class={`step ${i === current ? 'step--active' : ''} ${i < current ? 'step--done' : ''}`}>
            <span class="step-dot">{i < current ? '✓' : i + 1}</span>
            <span class="step-label">{label}</span>
          </li>
        ))}
      </ol>

      {stage === 'input' && (
        <div class="stage">
          <h1>Submit a SKILL.md</h1>
          <p class="prose lede">Paste a GitHub link to a <code>SKILL.md</code> (or a repo containing one). We parse it into a standard ARD <code>CatalogEntry</code> for review before publishing.</p>
          <div class="url-row">
            <label class="url-field">
              <span class="url-prefix mono">github.com/</span>
              <input
                type="text"
                aria-label="GitHub path to a SKILL.md"
                placeholder="owner/repo/tree/main/skills/pdf"
                value={url}
                onInput={(e) => setUrl((e.currentTarget as HTMLInputElement).value)}
                onKeyDown={(e) => { if (e.key === 'Enter') parse(); }}
              />
            </label>
            <Button variant="primary" onClick={parse}>Parse SKILL.md</Button>
          </div>
          <div class="examples">
            <span class="mono ex-try">try</span>
            {EXAMPLES.map((e) => <button key={e} class="ex-chip" type="button" onClick={() => setUrl(e)}>{e}</button>)}
          </div>
          <Notice label="Requirements">Public GitHub source · a valid <code>SKILL.md</code> with name + description · we index metadata only, never mirror your content.</Notice>
        </div>
      )}

      {(stage === 'parsing' || stage === 'publishing') && (
        <div class="loading">
          <div class="spinner" aria-hidden="true" />
          <p class="mono">{stage === 'parsing' ? `Parsing ${parseUrl(url).name}/SKILL.md…` : 'Publishing to registry…'}</p>
        </div>
      )}

      {stage === 'preview' && entry && (
        <div class="stage">
          <h1>Review the entry</h1>
          <p class="prose lede">Generated from your source. Confirm it reads correctly, then publish.</p>
          <article class="entry-card">
            <div class="entry-top">
              <span class="cap-cat mono">{entry.category} · generated</span>
              <Score value={entry.score} variant="big" />
            </div>
            <h2>{entry.name}</h2>
            <p class="entry-desc">{entry.description}</p>
            <div class="tagrow tagrow--lg">{entry.capabilities.map((c) => <Tag mono key={c}>{c}</Tag>)}</div>
            <div class="tagrow">{entry.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
            <ul class="q-list">{entry.queries.map((q) => <li key={q}>{q}</li>)}</ul>
            <ul class="findings">{entry.findings.map((f) => <ValidationFinding key={f.code} severity={f.severity} code={f.code} message={f.message} />)}</ul>
          </article>
          <div class="btn-row">
            <Button variant="primary" onClick={publish}>Publish to registry</Button>
            <Button onClick={reset}>Back / edit URL</Button>
          </div>
          <Notice label="Note">The score measures ARD metadata quality, not safety or trust. Publishing is reviewed before it appears in the public catalog.</Notice>
        </div>
      )}

      {stage === 'submitted' && entry && (
        <div class="stage success">
          <div class="success-badge" aria-hidden="true">✓</div>
          <h1>Submitted.</h1>
          <p class="prose lede">{entry.name} is queued for review. Once approved it appears in Explore and gets a hosted ai-catalog.json.</p>
          <KV items={[
            { label: 'slug', value: entry.name },
            { label: 'score', value: `${entry.score}/100` },
            { label: 'category', value: entry.category },
            { label: 'indexed', value: entry.source.indexed }
          ]} />
          <div class="btn-row">
            <Button variant="primary" href={`/skills/${entry.name}`}>View capability →</Button>
            <Button href="/explore">Back to Explore</Button>
            <Button variant="ghost" onClick={reset}>Submit another</Button>
          </div>
        </div>
      )}
    </div>
  );
}
