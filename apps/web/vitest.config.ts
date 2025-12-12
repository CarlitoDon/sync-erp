import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      all: true,
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
