import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node18',
  clean: true,
  // Force .js extension for CJS output (Hostinger Node.js expects index.js)
  outExtension: () => ({ js: '.js' }),
  // Bundle workspace packages only
  noExternal: ['@sync-erp/database', '@sync-erp/shared'],
  // Keep runtime dependencies external - CJS can resolve them from node_modules
  external: [
    '@prisma/client',
    '@prisma/adapter-pg',
    'pg-native',
    'bcrypt',
  ],
});
