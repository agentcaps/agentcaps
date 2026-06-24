interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

type Listing = Record<string, any>;

interface WeightedField {
  name: string;
  value: string;
  weight: number;
}

function tokenize(input: string): string[] {
  return [...new Set(input.toLowerCase().split(/[^a-z0-9]+/).map((token) => token.trim()).filter((token) => token.length > 1))];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

function fieldScore(field: WeightedField, term: string): number {
  if (!field.value) return 0;
  const tokens = tokenize(field.value);
  if (tokens.includes(term)) return field.weight;
  if (tokens.some((token) => token.startsWith(term))) return Math.round(field.weight * 0.65);
  if (field.value.includes(term)) return Math.round(field.weight * 0.35);
  return 0;
}

function weightedFields(listing: Listing): WeightedField[] {
  const entry = listing.catalogEntry ?? {};
  return [
    { name: 'displayName', value: text(entry.displayName), weight: 120 },
    { name: 'slug', value: text(listing.slug), weight: 90 },
    { name: 'tags', value: (entry.tags ?? []).join(' ').toLowerCase(), weight: 70 },
    { name: 'capabilities', value: (entry.capabilities ?? []).join(' ').toLowerCase(), weight: 60 },
    { name: 'representativeQueries', value: (entry.representativeQueries ?? []).join(' ').toLowerCase(), weight: 40 },
    { name: 'sourcePath', value: text(listing.sourcePath), weight: 35 },
    { name: 'description', value: text(entry.description), weight: 24 }
  ];
}

function rankListing(listing: Listing, query: string, terms: string[]) {
  const fields = weightedFields(listing);
  const phrase = query.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  for (const term of terms) {
    let best = { field: '', score: 0 };
    for (const field of fields) {
      const current = fieldScore(field, term);
      if (current > best.score) best = { field: field.name, score: current };
    }
    if (best.score > 0) {
      score += best.score;
      reasons.push(`${best.field}:${term}`);
    }
  }

  const [displayName, slug] = [text(listing.catalogEntry?.displayName), text(listing.slug)];
  if (phrase && displayName === phrase) score += 180;
  else if (phrase && slug === phrase) score += 150;
  else if (phrase && displayName.includes(phrase)) score += 80;
  else if (phrase && slug.includes(phrase)) score += 60;

  return { score, reasons };
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const body = await context.request.json().catch(() => ({})) as { query?: string; limit?: number };
  const query = String(body.query ?? '').trim();
  const limit = Math.min(Math.max(Number(body.limit ?? 10), 1), 50);
  const assetsUrl = new URL('/listings.json', context.request.url);
  const response = await context.env.ASSETS.fetch(new Request(assetsUrl));
  const listings = await response.json() as Listing[];
  const terms = tokenize(query);
  const results = listings
    .map((listing) => {
      const rank = rankListing(listing, query, terms);
      return {
        slug: listing.slug,
        score: rank.score,
        catalogEntry: listing.catalogEntry,
        matchReasons: rank.reasons,
        source: { url: listing.sourceUrl, path: listing.sourcePath }
      };
    })
    .filter((result) => !terms.length || result.score > 0)
    .sort((a, b) => b.score - a.score || a.catalogEntry.displayName.localeCompare(b.catalogEntry.displayName))
    .slice(0, limit);

  return Response.json({ results, query });
}
