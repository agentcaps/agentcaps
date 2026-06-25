import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  site: 'https://agentcaps.dev',
  output: 'static',
  integrations: [preact({ compat: true })]
});
