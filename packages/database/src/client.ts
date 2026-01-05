import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { PrismaClient } from './generated/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try loading from package root (packages/database/.env)
const pkgEnvPath = resolve(__dirname, '../.env');
let result = dotenv.config({ path: pkgEnvPath });

if (result.error) {
  // Fallback to project root (.env)
  const rootEnvPath = resolve(__dirname, '../../../.env');
  result = dotenv.config({ path: rootEnvPath });
  if (result.error) {
    console.error(
      `Failed to load .env from ${pkgEnvPath} and ${rootEnvPath}`
    );
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
