#!/usr/bin/env bash
# Rebuild and deploy agentcaps.dev after enrichment.
# Run from agentcaps/agentcaps/:
#   bash scripts/rebuild-and-deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Merging enriched sources ==="
node scripts/merge-enriched-sources.mjs

echo "=== Importing all sources ==="
pnpm registry:import

echo "=== Publishing all entries ==="
pnpm registry:publish

echo "=== Building registry ==="
pnpm registry:build

echo "=== Building site ==="
pnpm build

echo "=== Deploying to Cloudflare Pages ==="
npx wrangler pages deploy dist --project-name agentcaps --branch main

echo "=== Done ==="
