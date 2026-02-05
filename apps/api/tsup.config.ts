import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  platform: 'node',
  // Bundle all dependencies (avoids Hostinger symlink issues)
  noExternal: [/.*/],
  // Native modules MUST be external - use regex to match any import path containing these
  external: [/bcrypt/, /pg-native/, /node-gyp-build/],
  // Shim import.meta.url for bundled code
  shims: true,
  splitting: false,
  // Create a require function for CJS modules that use dynamic require
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
});
