import { Button, CapCard, CapListRow, EmptyState } from '@agentcaps/ui';
import { query } from '../state/search';

export interface CapItem {
  slug: string;
  name: string;
  href: string;
  description?: string;
  category?: string;
  score?: number;
  tags?: string[];
  /** Pre-lowercased searchable blob. */
  haystack: string;
  hostedHref?: string;
  githubUrl?: string;
}

interface Props {
  items: CapItem[];
  layout?: 'grid' | 'list';
  heading?: string;
  /** Render a standalone count line when there is no heading. */
  showCount?: boolean;
  /** Noun used in the count line, e.g. "capabilities". */
  countNoun?: string;
}

/** Island: filters the capability set by the shared query signal and renders it. */
export default function CapabilityResults({ items, layout = 'grid', heading, showCount, countNoun = 'shown' }: Props) {
  const q = query.value.trim().toLowerCase();
  const shown = q ? items.filter((item) => item.haystack.includes(q)) : items;
  const total = items.length;
  const count = q
    ? <><b>{shown.length}</b> of {total} {countNoun}</>
    : <><b>{total}</b> {countNoun}</>;

  return (
    <>
      {heading ? (
        <div class="section-head">
          <h2>{heading}</h2>
          <span class="count" aria-live="polite">{count}</span>
        </div>
      ) : showCount ? (
        <div class="count results-count" aria-live="polite">{count}</div>
      ) : null}

      {layout === 'grid' ? (
        <div class="cap-grid">
          {shown.map((item) => (
            <CapCard
              key={item.slug}
              name={item.name}
              href={item.href}
              description={item.description}
              category={item.category}
              score={item.score}
              tags={item.tags}
              linkLabel={item.hostedHref ? 'Hosted ARD →' : 'View →'}
              linkHref={item.hostedHref ?? item.href}
            />
          ))}
        </div>
      ) : (
        <ul class="cap-list">
          {shown.map((item) => (
            <CapListRow
              key={item.slug}
              name={item.name}
              href={item.href}
              description={item.description}
              category={item.category}
              score={item.score}
              tags={item.tags}
            >
              <Button href={item.href}>Details</Button>
              {item.githubUrl && <Button href={item.githubUrl} rel="noreferrer">GitHub</Button>}
              {item.hostedHref && <Button variant="ghost" href={item.hostedHref}>Hosted ARD</Button>}
            </CapListRow>
          ))}
        </ul>
      )}

      <EmptyState show={q !== '' && shown.length === 0} query={query.value.trim()} onClear={() => (query.value = '')} />
    </>
  );
}
