import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  platform: 'node',
  bundle: true,
  splitting: false,
  // Force bundle workspace packages (tsup treats them as external by default)
  noExternal: ['@sync-erp/database', '@sync-erp/shared'],
  // Keep native modules external
  external: [
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
