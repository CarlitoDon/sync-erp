/**
 * Redis client singleton for the API server.
 *
 * Connects to the URL specified by REDIS_URL env var.
 * Falls back to redis://localhost:6379 for local development.
 * Uses lazyConnect so the API boots even if Redis is temporarily down.
 */
import Redis from 'ioredis';

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;

  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  client = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    family: 0, // Support both IPv4 and IPv6 (crucial for Railway/Hostinger)
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'sync-erp:api:',
  });

  return client;
}

/**
 * Gracefully close the Redis connection (for tests / shutdown).
 */
export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
