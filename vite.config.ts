import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// VITE_BASE=/<repo>/ for GitHub Pages; './' works for any static host (Docker, preview).
const base = process.env.VITE_BASE ?? './';
// Public URL used for canonical, Open Graph and sitemap: social crawlers need absolute links.
const siteUrl = (process.env.SITE_URL ?? 'https://hstev.github.io/simple-sample/').replace(/\/?$/, '/');

function seo(): Plugin {
  return {
    name: 'seo',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
    generateBundle() {
      const lastmod = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${siteUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <image:image><image:loc>${siteUrl}social/og-image.png</image:loc></image:image>
  </url>
</urlset>
`,
      });
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    svelte(),
    seo(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Simple Sample — Sampler',
        short_name: 'Simple Sample',
        description: 'Sampler web gratis estilo MPC: corta canciones y tócalas en pads con el teclado, la pantalla táctil o MIDI.',
        lang: 'es',
        categories: ['music', 'entertainment', 'utilities'],
        theme_color: '#0b0b10',
        background_color: '#0b0b10',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Social preview images are only for crawlers; keep them out of the offline cache.
        globIgnores: ['social/og-*.png'],
        // Tracks served by the Docker helper must never be cached by the SW.
        navigateFallbackDenylist: [/^\/?tracks\//],
      },
    }),
  ],
  worker: { format: 'es' },
  server: { host: true },
});
