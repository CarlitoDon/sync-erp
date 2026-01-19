import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { PrismaClient } from './generated/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine environment and load appropriate .env file
// Railway sets NODE_ENV=production for ALL environments, so we check RAILWAY_ENVIRONMENT first
// Priority: RAILWAY_ENVIRONMENT > NODE_ENV
function getEnvFile(): string {
  const railwayEnv = process.env.RAILWAY_ENVIRONMENT; // 'staging' or 'production' on Railway
  const nodeEnv = process.env.NODE_ENV;

  // Railway environment takes precedence
  if (railwayEnv === 'staging') return '.env.staging';
  if (railwayEnv === 'production') return '.env.production';

  // Fallback to NODE_ENV for local development
  if (nodeEnv === 'test' || process.env.VITEST) return '.env.test';
  if (nodeEnv === 'staging') return '.env.staging';
  if (nodeEnv === 'production') return '.env.production';

  return '.env';
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
        ? ['error', 'warn']
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

/**
 * Execute a callback within a company context for RLS enforcement.
 * Sets the PostgreSQL session variable 'app.current_company' before running queries.
 *
 * @param companyId - The company ID to set as context
 * @param callback - The async function to execute within the context
 * @returns The result of the callback
 *
 * @example
 * ```ts
 * const orders = await withCompanyContext(ctx.companyId, async () => {
 *   return prisma.rentalOrder.findMany();
 * });
 * ```
 */
export async function withCompanyContext<T>(
  companyId: string,
  callback: () => Promise<T>
): Promise<T> {
  // Set the session variable for RLS
  await prisma.$executeRaw`SELECT set_config('app.current_company', ${companyId}, false)`;

  // Execute the callback
  return callback();
}

/**
 * Set company context without executing a callback.
 * Useful for transaction blocks where you need to set context before multiple operations.
 */
export async function setCompanyContext(
  companyId: string
): Promise<void> {
  await prisma.$executeRaw`SELECT set_config('app.current_company', ${companyId}, false)`;
}
