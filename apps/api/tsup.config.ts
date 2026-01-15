import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  // External: real npm packages that should stay external
  external: [
    '@prisma/client',
    '@prisma/adapter-pg',
    'pg',
    'express',
    'cors',
    'helmet',
    'cookie-parser',
    'bcrypt',
    '@trpc/server',
    'superjson',
    'zod',
    'dotenv',
  ],
  // Bundle workspace packages to avoid ESM import issues
  noExternal: ['@sync-erp/database', '@sync-erp/shared'],
});
