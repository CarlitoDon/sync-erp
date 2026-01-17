import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine environment and load appropriate .env file
// Priority: test > development > production
function getEnvFile(): string {
  const isTest =
    process.env.NODE_ENV === 'test' || process.env.VITEST;
  const isProd = process.env.NODE_ENV === 'production';

  if (isTest) return '.env.test';
  if (isProd) return '.env.production';
  return '.env';
}

const envFile = getEnvFile();
const pkgEnvPath = path.resolve(__dirname, `../${envFile}`);

// eslint-disable-next-line no-console
console.log(`[Bot] Loading ${envFile} from ${pkgEnvPath}`);

let result = dotenv.config({ path: pkgEnvPath });

if (result.error) {
  // Fallback to generic .env if specific file not found
  const fallbackPath = path.resolve(__dirname, '../.env');
  // eslint-disable-next-line no-console
  console.log(`[Bot] Fallback to ${fallbackPath}`);
  result = dotenv.config({ path: fallbackPath });
  if (result.error) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Bot] Failed to load environment from ${pkgEnvPath}`
    );
  }
}

// Load shared environment variables (if needed fallback, though usually monorepo specific)
const sharedEnvPath = path.resolve(
  __dirname,
  '../../../packages/database/.env'
);
dotenv.config({ path: sharedEnvPath });

import { startServer } from './server';
import { initializeBaileys, getSocket } from './bot/baileys';

// Start Express Server
startServer();

// Start Baileys WhatsApp Client
// eslint-disable-next-line no-console
console.log('Initializing Baileys WhatsApp Client...');
initializeBaileys();

// Graceful shutdown to prevent credential corruption
const gracefulShutdown = async (signal: string) => {
  // eslint-disable-next-line no-console
  console.log(`\n[${signal}] Shutting down gracefully...`);
  const sock = getSocket();
  if (sock) {
    try {
      sock.end(undefined);
      // eslint-disable-next-line no-console
      console.log('[Baileys] Socket closed successfully.');
    } catch {
      // Ignore errors during shutdown
    }
  }
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
