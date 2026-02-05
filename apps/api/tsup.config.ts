import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  platform: 'node',
  bundle: true,
  splitting: false,
  // Only bundle shared types (no native deps)
  noExternal: ['@sync-erp/shared'],
  // Keep Prisma and database external (need proper node_modules resolution)
  external: [
    '@sync-erp/database',
    '@prisma/client',
    '@prisma/adapter-pg',
    'bcrypt',
    'pg-native',
    /\.node$/, // Native addon files
  ],
  // Shim import.meta for bundled code
  shims: true,
  // Create a require function for CJS modules that use dynamic require
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
});
