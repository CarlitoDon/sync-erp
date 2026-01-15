import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    '@trpc/client',
    '@trpc/server',
    '@whiskeysockets/baileys',
    'express',
    'cors',
    'body-parser',
    'dotenv',
    'ioredis',
    'pino',
    'qrcode',
    'superjson',
    'zod',
    'archiver',
    'fs-extra',
  ],
  // Bundle workspace packages
  noExternal: ['@sync-erp/shared'],
});
