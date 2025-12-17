/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    name: '@sync-erp/web',
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
});
