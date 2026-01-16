import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  // Bundle workspace packages
  noExternal: ['@sync-erp/database', '@sync-erp/shared'],
  external: [
    'dotenv',
    'pg',
    'bcrypt',
    'bcryptjs',
    'express',
    'cors',
    'helmet',
    'cookie-parser',
    'superjson',
    'zod',
    '@trpc/server',
  ],
});
