import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { PrismaClient } from './generated/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine environment and load appropriate .env file
// Priority: test > development > production
function getEnvFile(): string {
  const isTest =
    process.env.NODE_ENV === 'test' || process.env.VITEST;
  const isProd = process.env.NODE_ENV === 'production';

  if (isTest) return '.env.test';
  if (isProd) return '.env.production';
  return '.env.development';
}

const envFile = getEnvFile();
const pkgEnvPath = resolve(__dirname, `../${envFile}`);

// eslint-disable-next-line no-console
console.log(`[Database] Loading ${envFile} from ${pkgEnvPath}`);

let result = dotenv.config({ path: pkgEnvPath });

if (result.error) {
  // Fallback to generic .env if specific file not found
  const fallbackPath = resolve(__dirname, '../.env');
  // eslint-disable-next-line no-console
  console.log(`[Database] Fallback to ${fallbackPath}`);
  result = dotenv.config({ path: fallbackPath });
  if (result.error) {
    console.error(`Failed to load environment from ${pkgEnvPath}`);
  }
}

const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    // Increase transaction timeout to handle Railway <-> Supabase latency
    transactionOptions: {
      maxWait: 10000, // Max wait time to acquire transaction: 10s
      timeout: 30000, // Transaction operation timeout: 30s
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient } from './generated/client/client.js';
export { Prisma } from './generated/client/client.js';
