import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Determine environment and load appropriate .env file
function loadEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const isStaging = process.env.NODE_ENV === 'staging';
  const isTest =
    process.env.NODE_ENV === 'test' || process.env.VITEST;

  let envFile = '.env';
  if (isProd) {
    envFile = '.env.production';
  } else if (isStaging) {
    envFile = '.env.staging';
  } else if (isTest) {
    envFile = '.env.test';
  }

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
    url:
      process.env.DATABASE_URL ??
      'postgresql://postgres:password@localhost:5432/postgres',
  },
});
