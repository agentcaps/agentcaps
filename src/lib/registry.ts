import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface PublicListing {
  slug: string;
  catalogEntry: {
    identifier: string;
    displayName: string;
    type: string;
    url?: string;
    description?: string;
    tags?: string[];
    capabilities?: string[];
    representativeQueries?: string[];
    updatedAt?: string;
  };
  validation: {
    score: number;
    errors: Array<{ code: string; message: string; severity: string }>;
    warnings: Array<{ code: string; message: string; severity: string }>;
    info: Array<{ code: string; message: string; severity: string }>;
    summary: string;
  };
  publicationStatus: string;
  driftStatus: string;
  source: {
    slug: string;
    type: string;
    url: string;
    path?: string;
    curation?: {
      category?: string;
      reason?: string;
      seoKeywords?: string[];
    };
  };
  snapshot: {
    sourceWebUrl?: string;
    sourceCommit?: string;
    sourceDigest: string;
    rawArtifactUrl: string;
    artifactPath: string;
    fetchedAt: string;
  };
}

const listingsDir = join(process.cwd(), 'data/registry/dist/listings');

export function getListings(): PublicListing[] {
  return readdirSync(listingsDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(listingsDir, file), 'utf8')) as PublicListing)
    .sort((a, b) => a.catalogEntry.displayName.localeCompare(b.catalogEntry.displayName));
}

export function getListing(slug: string): PublicListing | undefined {
  return getListings().find((listing) => listing.slug === slug);
}

export function getCatalog() {
  return JSON.parse(readFileSync(join(process.cwd(), 'data/registry/dist/ai-catalog.json'), 'utf8'));
}
