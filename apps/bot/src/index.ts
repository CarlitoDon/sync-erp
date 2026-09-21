import './env';

import { startServer } from './server';
import { initializeBaileys, getSocket } from './bot/baileys';
import { seedWhitelistFromEnv } from './utils/whitelist';

// Start Express Server
startServer();

// Seed whitelist from env into Redis (SADD, does not wipe existing entries)
seedWhitelistFromEnv().catch((err) => {
  // eslint-disable-next-line no-console
  console.warn('[startup] Failed to seed whitelist from env:', err instanceof Error ? err.message : String(err));
});

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
