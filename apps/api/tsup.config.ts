import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  platform: 'node',
  // ESM needs to bundle everything to avoid Hostinger's symlinked node_modules issues
  noExternal: [/.*/],
  // Keep native modules external
  external: ['pg-native', 'bcrypt'],
  // Shim import.meta.url for bundled code
  shims: true,
  splitting: false,
  // Create a require function for CJS modules that use dynamic require
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
});
