# AgentCaps

Public curated registry and website for agent capabilities, powered by AgentCaps Registry.

AgentCaps imports curated GitHub-hosted `SKILL.md` projects, generates ARD CatalogEntries, and exposes a searchable public reference registry for agent builders.

```text
GitHub SKILL.md
-> AgentCaps Registry import pipeline
-> reviewed CatalogEntry
-> public listing
-> /.well-known/ai-catalog.json and POST /search
```

## Relationship to AgentCaps Registry

This repository is the public website and reference deployment for `agentcaps.dev`.

The reusable registry engine lives at:

```text
https://github.com/agentcaps/registry
```

Dependency direction:

```text
agentcaps/agentcaps -> agentcaps/registry
```

The public site depends on the registry engine. The registry engine does not depend on the public site.

## V0 Scope

V0 is a curated public registry, not an open marketplace.

It supports:

- curated GitHub `SKILL.md` sources;
- generated ARD CatalogEntries;
- listing pages;
- validation report display;
- copy CatalogEntry;
- source GitHub links;
- public `/.well-known/ai-catalog.json`;
- Cloudflare Pages Function for `POST /search`;
- GitHub issue flow for submitting new `SKILL.md` candidates.

It does not support:

- login;
- open user publishing;
- paste URL preview;
- publisher verification badges;
- automatic skill installation;
- MCP / A2A / OpenAPI source types in V0.

## Development

Requirements:

- Node.js `>=22`
- pnpm
- git

Install dependencies:

```bash
pnpm install
```

Refresh registry data:

```bash
pnpm registry:refresh
```

Build the site:

```bash
pnpm build
```

Run locally:

```bash
pnpm dev
```

## Data Flow

```text
data/registry/sources.yaml
-> agentcaps-registry import --all
-> agentcaps-registry publish --all
-> agentcaps-registry build
-> data/registry/dist/*
-> scripts/sync-public-registry.mjs
-> public /.well-known/ai-catalog.json, search-index.json, listings.json
-> Astro pages and Cloudflare Pages Function
```

## Submit a SKILL.md

For V0, submissions go through GitHub issues instead of in-product login or open publishing:

```text
https://github.com/agentcaps/registry/issues/new?template=submit-skill.yml
```

## License

Apache-2.0. See `LICENSE`.
