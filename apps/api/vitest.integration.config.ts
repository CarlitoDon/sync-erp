import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      '@modules': path.resolve(__dirname, 'src/modules'),
    },
  },
  test: {
    name: '@sync-erp/api-integration',
    globals: true,
    environment: 'node',
    // Run integration and e2e tests against real database (no mocks)
    include: [
      'test/integration/**/*.test.ts',
      'test/e2e/**/*.test.ts',
    ],
    // No setupFiles - uses real database and running server
    testTimeout: 60000, // Integration tests may take longer (Prisma Postgres)
  },
});
