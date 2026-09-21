import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  dts: process.env.NO_DTS !== 'true',
  external: [ 'dotenv'],
});
