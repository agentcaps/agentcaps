interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

function tokenize(input: string): string[] {
  return input.toLowerCase().split(/[^a-z0-9]+/).map((token) => token.trim()).filter((token) => token.length > 1);
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const body = await context.request.json().catch(() => ({})) as { query?: string; limit?: number };
  const query = String(body.query ?? '').trim();
  const limit = Number(body.limit ?? 10);
  const assetsUrl = new URL('/listings.json', context.request.url);
  const response = await context.env.ASSETS.fetch(new Request(assetsUrl));
  const listings = await response.json() as Array<Record<string, any>>;
  const terms = tokenize(query);
  const results = listings
    .map((listing) => {
      const entry = listing.catalogEntry;
      const fields = [
        entry.displayName,
        entry.description,
        ...(entry.tags ?? []),
        ...(entry.capabilities ?? []),
        ...(entry.representativeQueries ?? [])
      ];
      const text = fields.join(' ').toLowerCase();
      const matches = terms.filter((term) => text.includes(term));
      return {
        slug: listing.slug,
        score: matches.length,
        catalogEntry: entry,
        matchReasons: matches.map((term) => `metadata:${term}`),
        source: { url: listing.sourceUrl, path: listing.sourcePath }
      };
    })
    .filter((result) => !terms.length || result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return Response.json({ results, query });
}
