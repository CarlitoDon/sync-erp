import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'database',
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.ts'],
  },
});
