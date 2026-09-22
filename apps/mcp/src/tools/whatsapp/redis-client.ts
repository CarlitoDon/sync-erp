import { Redis } from 'ioredis';
import { getWhatsAppConfig } from '../../config.js';

let sharedRedis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!sharedRedis) {
    const config = getWhatsAppConfig();
    sharedRedis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      family: 0,
    });
  }
  return sharedRedis;
}
