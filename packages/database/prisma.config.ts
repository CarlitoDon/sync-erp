import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Determine environment and load appropriate .env file
function getEnvFile(): string {
  const isTest =
    process.env.NODE_ENV === 'test' || process.env.VITEST;
  const isProd = process.env.NODE_ENV === 'production';

  if (isTest) return '.env.test';
  if (isProd) return '.env.production';
  return '.env.development';
}

dotenv.config({ path: getEnvFile() });

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
