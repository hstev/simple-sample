import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// VITE_BASE=/<repo>/ for GitHub Pages; './' works for any static host (Docker, preview).
const base = process.env.VITE_BASE ?? './';

export default defineConfig({
  base,
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Simple Sample — Sampler',
        short_name: 'Simple Sample',
        description: 'Corta canciones y tócalas en pads estilo MPC.',
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
        // Tracks served by the Docker helper must never be cached by the SW.
        navigateFallbackDenylist: [/^\/?tracks\//],
      },
    }),
  ],
  worker: { format: 'es' },
  server: { host: true },
});
