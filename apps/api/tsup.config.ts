import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  // Bundle ALL dependencies to avoid ESM resolution issues on Hostinger
  noExternal: [/.*/],
  // Only keep native binaries external
  external: [
    '@prisma/client',
    '@prisma/adapter-pg',
    'pg-native',
    'bcrypt', // native addon
  ],
});
