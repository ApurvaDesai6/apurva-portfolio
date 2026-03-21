import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://apurvad.xyz',
  integrations: [sitemap(), mdx()],
  markdown: {
    shikiConfig: { theme: 'github-light' },
  },
});
