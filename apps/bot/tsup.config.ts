import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  // Bundle workspace packages
  noExternal: ['@sync-erp/shared'],
  external: [
    'dotenv',
    '@whiskeysockets/baileys',
    'qrcode',
    'ioredis',
    'pg',
    'pino',
    'express',
    'cors',
    'body-parser',
    'zod',
    '@prisma/client',
  ],
});
