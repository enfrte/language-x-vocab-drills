import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Vite build with PWA support.
 *
 * vite-plugin-pwa generates a Workbox service worker that precaches every
 * build asset (JS incl. the bundled .jsonl datasets, CSS, HTML, icons), so
 * the app works fully offline after the first visit — the requirement for
 * installable use on Vercel.
 */
export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        id: '/',
        name: 'Learn Language X',
        short_name: 'Learn Lang-X',
        description: 'Learn vocabulary, one word at a time. Works offline.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#e9eeac',
        theme_color: '#e9eeac',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache everything the app needs offline (the .jsonl datasets are
        // inlined in the JS bundle by Vite's `?raw` imports).
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^sw\.js$/, /^workbox-/],
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
