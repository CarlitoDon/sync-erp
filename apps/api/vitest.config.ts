import { defineConfig } from 'vitest/config';
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
      '@sync-erp/shared': path.resolve(
        __dirname,
        '../../packages/shared/src/index.ts'
      ),
    },
  },
  plugins: [],
  test: {
    name: '@sync-erp/api',
    globals: true,
    environment: 'node',
    // Include all tests - setup file handles mock conditionally
    include: [
      'test/unit/**/*.test.ts',
      'test/invariants/**/*.test.ts',
      'test/integration/**/*.test.ts',
      'test/e2e/**/*.test.ts',
    ],
    testTimeout: 60000,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 80,
        branches: 79,
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
        'src/index.ts',
        '**/*.repository.ts',
        '**/repositories/**',
      ],
    },
  },
});
