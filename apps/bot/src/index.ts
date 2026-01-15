import dotenv from 'dotenv';
import path from 'path';

// Load shared environment variables
const envPath = path.resolve(
  __dirname,
  '../../../packages/database/.env'
);
dotenv.config({ path: envPath });
// Also load local .env if exists (overrides shared)
dotenv.config();

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
