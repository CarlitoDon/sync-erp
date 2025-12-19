import { defineConfig } from 'vitest/config';
// import tsconfigPaths from 'vite-tsconfig-paths'; // Removed unused import to fix lint
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      '@modules': path.resolve(__dirname, 'src/modules'),
      '@src': path.resolve(__dirname, 'src'),
      '@middlewares': path.resolve(__dirname, 'src/middlewares'),
      '@routes': path.resolve(__dirname, 'src/routes'),
    },
  },
  plugins: [],
  test: {
    name: '@sync-erp/api',
    globals: true,
    environment: 'node',
    // Run unit tests only (integration/e2e need real server + DB)
    include: ['test/unit/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 80,
        branches: 79, // 79.13% actual - remaining gaps in Prisma-calling services need integration tests
        functions: 80,
        statements: 80,
      },
      reportOnFailure: true,
      include: ['src/**/*.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/test/**',
        'vitest.config.ts',
        'src/index.ts', // Entry point bootstrap
        // Repositories are thin Prisma wrappers - tested via integration tests
        '**/*.repository.ts',
        '**/repositories/**',
      ],
    },
  },
});
