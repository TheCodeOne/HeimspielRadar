import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function getFrontendVersion(): string {
  if (process.env.FRONTEND_VERSION) {
    return process.env.FRONTEND_VERSION;
  }

  try {
    const pkgPath = path.resolve(__dirname, 'package.json');

    if (fs.existsSync(pkgPath)) {
      // SAFETY: package.json follows standard npm package manifest schema
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };

      if (pkg.version) {
        return pkg.version;
      }
    }
  } catch {
    // fallback
  }

  return '0.1.0';
}

function getGitCommitSha(): string {
  if (process.env.GIT_COMMIT_SHA) {
    return process.env.GIT_COMMIT_SHA.slice(0, 7);
  }

  try {
    const sha = execSync('git rev-parse --short=7 HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (sha) {
      return sha.slice(0, 7);
    }
  } catch {
    // fallback
  }

  return 'dev';
}

const frontendVersion = getFrontendVersion();
const gitCommitSha = getGitCommitSha();
const buildTimestamp = process.env.BUILD_TIMESTAMP || new Date().toISOString();

export default defineConfig({
  define: {
    __FRONTEND_VERSION__: JSON.stringify(frontendVersion),
    __GIT_COMMIT_SHA__: JSON.stringify(gitCommitSha),
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'icon-192.png',
        'pwa-192x192.png',
        'icon-512.png',
        'icon-512-maskable.png',
      ],
      manifest: {
        id: '/',
        start_url: '/',
        name: 'HeimspielRadar',
        short_name: 'HeimspielRadar',
        description:
          'Amateur-Basketball Heimspiele & Sporthallen in deiner Nähe finden',
        categories: ['sports', 'entertainment'],
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait-primary',
        shortcuts: [
          {
            name: 'Spiele heute',
            short_name: 'Heute',
            description: 'Heimspiele am heutigen Tag anzeigen',
            url: '/?date=today',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Dieses Wochenende',
            short_name: 'Wochenende',
            description: 'Heimspiele am kommenden Wochenende',
            url: '/?date=weekend',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Listenansicht',
            short_name: 'Liste',
            description: 'Heimspiele als chronologische Liste',
            url: '/?view=list',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Story Generator',
            short_name: 'Story',
            description: 'Social Media Spieltags-Grafik generieren',
            url: '/story',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        importScripts: ['/sw-push.js'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\/matches.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-matches-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\/api\/leagues.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-leagues-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles-cache',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openfreemap-tiles-cache',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@sundayleague/shared-types': path.resolve(
        __dirname,
        '../../libs/shared-types/src/index.ts',
      ),
    },
  },
  build: {
    outDir: '../../dist/apps/frontend',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 4200,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
