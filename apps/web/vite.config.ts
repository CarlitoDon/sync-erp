/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Polyfill process.env for shared code compatibility
      'process.env.SYNC_ERP_API_URL': JSON.stringify(
        env.SYNC_ERP_API_URL
      ),
      'process.env.SYNC_ERP_API_SECRET': JSON.stringify(
        env.SYNC_ERP_API_SECRET
      ),
      'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV || mode),
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@sync-erp/shared': resolve(
          __dirname,
          '../../packages/shared/src/index.ts'
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
});
