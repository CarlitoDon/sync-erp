import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Determine environment and load appropriate .env file
// In production (Railway), env vars are set by the platform - don't use dotenv
function loadEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) return; // Railway sets env vars directly

  const isTest =
    process.env.NODE_ENV === 'test' || process.env.VITEST;
  const envFile = isTest ? '.env.test' : '.env';
  dotenv.config({ path: envFile });
}

loadEnv();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
