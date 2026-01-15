import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['@prisma/client', '@sync-erp/database'],
});
