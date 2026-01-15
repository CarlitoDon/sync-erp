import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  // Don't bundle these - they're external packages
  external: [
    '@prisma/client',
    '@sync-erp/database',
    '@sync-erp/shared',
    'express',
    'cors',
    'helmet',
    'cookie-parser',
    'bcrypt',
    '@trpc/server',
    'superjson',
    'zod',
  ],
  // Bundle all other dependencies
  noExternal: [],
});
