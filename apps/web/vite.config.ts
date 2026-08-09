/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { loadEnv, type ConfigEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const VITE_ENV_PREFIX = 'VITE_';

export function createWebViteConfig({ mode }: ConfigEnv): UserConfig {
  // Load env file based on mode
  // Use VERCEL_ENV (auto-set by Vercel: production/preview/development) for Vercel deployments
  // Fall back to Vite mode for local development
  const vercelEnv = process.env.VERCEL_ENV; // 'production' | 'preview' | 'development' | undefined

  // Determine which .env file to load
  // - On Vercel production: use 'production'
  // - On Vercel preview: use 'staging' (our .env.staging maps to preview)
  // - Local: use Vite mode
  let envMode = mode;
  if (vercelEnv === 'production') {
    envMode = 'production';
  } else if (vercelEnv === 'preview') {
    envMode = 'staging'; // Map preview to staging
  }

  console.log(
    '[Vite Config] VERCEL_ENV:',
    vercelEnv || 'NOT SET (local)'
  );
  console.log('[Vite Config] Resolved envMode:', envMode);

  // Only public VITE_* values may cross the web build boundary.
  const env = loadEnv(envMode, process.cwd(), VITE_ENV_PREFIX);
  const adsenseClientId = env.VITE_GOOGLE_ADSENSE_CLIENT_ID?.trim();
  const shouldInjectAdSense =
    env.VITE_GOOGLE_ADSENSE_ENABLED?.trim() === 'true' &&
    Boolean(adsenseClientId?.match(/^ca-pub-\d+$/));

  return {
    plugins: [
      {
        name: 'sync-erp-adsense-html',
        transformIndexHtml() {
          if (!shouldInjectAdSense || !adsenseClientId) {
            return [];
          }

          return [
            {
              tag: 'script',
              attrs: {
                async: true,
                crossorigin: 'anonymous',
                'data-sync-erp-adsense': 'true',
                src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`,
              },
              injectTo: 'head',
            },
          ];
        },
      },
      react({
        jsxRuntime: 'automatic',
      }),
      tailwindcss(),
    ],
    envPrefix: VITE_ENV_PREFIX,
    define: {
      // Keep the existing non-secret compatibility constant for dependencies.
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@sync-erp/shared': resolve(
          __dirname,
          './src/shared-browser.ts'
        ),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/health': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: [resolve(__dirname, './test/setup.ts')],
      include: ['test/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**'],
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/.turbo/**',
          '**/test/**',
          '**/*.config.ts',
          '**/*.d.ts',
          'src/main.tsx',
          'src/types/**',
        ],
        thresholds: {
          lines: 80,
          statements: 80,
        },
      },
    },
  };
}

export default defineConfig(createWebViteConfig);
