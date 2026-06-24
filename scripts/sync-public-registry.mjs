import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const distDir = join(root, 'data/registry/dist');
const publicDir = join(root, 'public');
const listingsDir = join(distDir, 'listings');

function parseGitHubRepoUrl(url) {
  const match = url.replace(/\.git$/, '').match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:[/#?].*)?$/);
  if (!match) return undefined;
  return { owner: match[1], repo: match[2] };
}

function catalogForEntries(entries) {
  return {
    specVersion: '1.0',
    host: {
      displayName: 'AgentCaps',
      identifier: 'urn:air:agentcaps.dev:registry:public',
      documentationUrl: 'https://agentcaps.dev'
    },
    entries
  };
}

await mkdir(join(publicDir, '.well-known'), { recursive: true });
await writeFile(
  join(publicDir, '.well-known/ai-catalog.json'),
  await readFile(join(distDir, 'ai-catalog.json'), 'utf8')
);
await writeFile(
  join(publicDir, 'search-index.json'),
  await readFile(join(distDir, 'search-index.json'), 'utf8')
);

const listingFiles = (await readdir(listingsDir)).filter((file) => file.endsWith('.json')).sort();
const listings = [];
const catalogsByRepo = new Map();
for (const file of listingFiles) {
  const listing = JSON.parse(await readFile(join(listingsDir, file), 'utf8'));
  const github = parseGitHubRepoUrl(listing.source.url);
  const hostedCatalogUrl = github ? `/@${github.owner}/${github.repo}/ai-catalog.json` : undefined;
  listings.push({
    slug: listing.slug,
    displayName: listing.catalogEntry.displayName,
    description: listing.catalogEntry.description,
    tags: listing.catalogEntry.tags ?? [],
    capabilities: listing.catalogEntry.capabilities ?? [],
    representativeQueries: listing.catalogEntry.representativeQueries ?? [],
    validationScore: listing.validation.score,
    sourceUrl: listing.source.url,
    sourcePath: listing.source.path,
    sourceCommit: listing.snapshot.sourceCommit,
    hostedCatalogUrl,
    catalogEntry: listing.catalogEntry
  });

  if (github) {
    const key = `${github.owner}/${github.repo}`;
    const existing = catalogsByRepo.get(key) ?? { github, entries: [] };
    existing.entries.push(listing.catalogEntry);
    catalogsByRepo.set(key, existing);
  }
}
await writeFile(join(publicDir, 'listings.json'), `${JSON.stringify(listings, null, 2)}\n`);

for (const { github, entries } of catalogsByRepo.values()) {
  const dir = join(publicDir, `@${github.owner}`, github.repo);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'ai-catalog.json'), `${JSON.stringify(catalogForEntries(entries), null, 2)}\n`);
}

console.log(`Synced ${listings.length} public listings and ${catalogsByRepo.size} hosted catalog route(s).`);
