import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Run integration and e2e tests against real database (no mocks)
    include: [
      'test/integration/**/*.test.ts',
      'test/e2e/**/*.test.ts',
    ],
    // No setupFiles - uses real database
    testTimeout: 30000, // Integration tests may take longer
  },
});
