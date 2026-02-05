import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  // ESM needs to bundle everything to avoid Hostinger's symlinked node_modules issues
  noExternal: [/.*/],
  // Only truly native modules stay external
  external: ['@prisma/client/runtime/*', 'pg-native', 'bcrypt'],
  // Shim import.meta.url for bundled code that tries to use it
  shims: true,
  // Allow dynamic imports for Prisma
  splitting: false,
});
