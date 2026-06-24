import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const distDir = join(root, 'data/registry/dist');
const publicDir = join(root, 'public');
const listingsDir = join(distDir, 'listings');

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
for (const file of listingFiles) {
  const listing = JSON.parse(await readFile(join(listingsDir, file), 'utf8'));
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
    catalogEntry: listing.catalogEntry
  });
}
await writeFile(join(publicDir, 'listings.json'), `${JSON.stringify(listings, null, 2)}\n`);
console.log(`Synced ${listings.length} public listings.`);
