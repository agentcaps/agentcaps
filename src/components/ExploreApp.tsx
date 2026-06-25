import { useEffect, useMemo, useState } from 'preact/hooks';
import { Button, CapCard, CapListRow, EmptyState, SearchBox } from '@agentcaps/ui';

export interface ExploreItem {
  slug: string;
  name: string;
  href: string;
  description?: string;
  category: string;
  score?: number;
  tags?: string[];
  haystack: string;
  hostedHref?: string;
  githubUrl?: string;
}

const EXAMPLES = ['pdf', 'browser automation', 'slides', 'sql'];

/** Island: the full Explore experience — search, example chips, category pills,
 *  grid/list toggle, and ?q/?cat URL seeding (detail-page tags link in here). */
export default function ExploreApp({ items }: { items: ExploreItem[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // Seed from the URL once (?q=, ?cat=).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const q = p.get('q');
    const c = p.get('cat');
    if (q) setQuery(q);
    if (c) setCategory(c);
  }, []);

  // Reflect state back into the URL for shareable searches.
  useEffect(() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    if (category !== 'all') p.set('cat', category);
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [query, category]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of items) counts.set(it.category, (counts.get(it.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const q = query.trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];
  const shown = useMemo(
    () =>
      items
        .filter((it) => {
          if (category !== 'all' && it.category !== category) return false;
          return terms.every((t) => it.haystack.includes(t));
        })
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [items, q, category]
  );

  return (
    <>
      <section class="ex-hero">
        <div class="ex-eyebrow mono">AgentCaps · private skill registry</div>
        <h1>Find the right capability.</h1>
        <p class="ex-sub">
          Search agent skills indexed from GitHub <code>SKILL.md</code> files — scored for ARD
          metadata quality and ready to wire into your stack.
        </p>
        <div class="hero-search">
          <SearchBox
            autofocus
            placeholder="pdf, browser automation, slides…"
            clearLabel="clear"
            value={query}
            onInput={setQuery}
            onClear={() => setQuery('')}
          />
        </div>
        <div class="examples">
          <span class="mono ex-try">try</span>
          {EXAMPLES.map((e) => (
            <button key={e} class="ex-chip" type="button" onClick={() => setQuery(e)}>{e}</button>
          ))}
        </div>
      </section>

      <div class="controls">
        <div class="pills">
          <button class={`pill ${category === 'all' ? 'pill--active' : ''}`} type="button" onClick={() => setCategory('all')}>
            All <span class="n">{items.length}</span>
          </button>
          {categories.map(([c, n]) => (
            <button key={c} class={`pill ${category === c ? 'pill--active' : ''}`} type="button" onClick={() => setCategory(c)}>
              {c} <span class="n">{n}</span>
            </button>
          ))}
        </div>
        <div class="controls-right">
          <span class="result-count mono"><b>{shown.length}</b> of {items.length} shown</span>
          <div class="view-toggle" role="group" aria-label="View">
            <button class={`view-btn ${view === 'grid' ? 'view-btn--active' : ''}`} type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Grid</button>
            <button class={`view-btn ${view === 'list' ? 'view-btn--active' : ''}`} type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
          </div>
        </div>
      </div>

      <section class="ex-results">
        {view === 'grid' ? (
          <div class="cap-grid">
            {shown.map((it) => (
              <CapCard
                key={it.slug}
                name={it.name}
                href={it.href}
                description={it.description}
                category={it.category}
                score={it.score}
                tags={it.tags}
                linkLabel={it.hostedHref ? 'Hosted ARD →' : 'View →'}
                linkHref={it.hostedHref ?? it.href}
              />
            ))}
          </div>
        ) : (
          <ul class="cap-list">
            {shown.map((it) => (
              <CapListRow key={it.slug} name={it.name} href={it.href} description={it.description} category={it.category} score={it.score} tags={it.tags}>
                <Button href={it.href}>Details</Button>
                {it.githubUrl && <Button href={it.githubUrl} rel="noreferrer">GitHub</Button>}
                {it.hostedHref && <Button variant="ghost" href={it.hostedHref}>Hosted ARD</Button>}
              </CapListRow>
            ))}
          </ul>
        )}
        <EmptyState show={shown.length === 0} query={query.trim()} onClear={() => { setQuery(''); setCategory('all'); }} />
      </section>
    </>
  );
}
