/**
 * Redis-backed rate limit service.
 *
 * Replaces the in-memory PublicRateLimitService for production use.
 * Rate limits persist across API restarts and work across multiple instances.
 *
 * Uses Redis EXPIRE for automatic window cleanup — no manual sweep needed.
 */

import { getRedis } from './redis';

export interface RateLimitConfig {
  namespace: string;
  maxAttempts: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class RedisRateLimitService {
  /**
   * Consume one attempt for the given identifier + config.
   *
   * Uses a single Lua script for atomicity:
   *   1. INCR the counter
   *   2. If counter == 1, set EXPIRE (start the window)
   *   3. Return current count and TTL
   */
  async consume(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const redis = getRedis();
    const key = `ratelimit:${config.namespace}:${identifier}`;
    const windowSeconds = Math.ceil(config.windowMs / 1000);

    // Lua script: atomic INCR + conditional EXPIRE + TTL lookup
    const luaScript = `
      local key = KEYS[1]
      local window = tonumber(ARGV[1])
      local current = redis.call('INCR', key)
      if current == 1 then
        redis.call('EXPIRE', key, window)
      end
      local ttl = redis.call('TTL', key)
      return {current, ttl}
    `;

    try {
      const result = (await redis.eval(luaScript, 1, key, windowSeconds)) as [
        number,
        number
      ];
      const [count, ttl] = result;

      const retryAfterSeconds = Math.max(ttl, 1);

      if (count > config.maxAttempts) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds,
        };
      }

      return {
        allowed: true,
        remaining: Math.max(config.maxAttempts - count, 0),
        retryAfterSeconds,
      };
    } catch (error) {
      // Graceful fallback for test environments or temporary Redis downtime
      console.warn('[RedisRateLimitService] Connection failed, defaulting to allowed');
      return { allowed: true, remaining: config.maxAttempts, retryAfterSeconds: 0 };
    }
  }

  /**
   * Check rate limit without consuming (for informational headers).
   */
  async peek(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const redis = getRedis();
    const key = `ratelimit:${config.namespace}:${identifier}`;

    const count = await redis.get(key);
    const ttl = await redis.ttl(key);
    const current = count ? parseInt(count, 10) : 0;
    const retryAfterSeconds = Math.max(ttl, 1);

    if (current >= config.maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(config.maxAttempts - current, 0),
      retryAfterSeconds,
    };
  }

  /**
   * Reset rate limit for a specific identifier (admin/unblock use).
   */
  async reset(identifier: string, namespace: string): Promise<void> {
    const redis = getRedis();
    const key = `ratelimit:${namespace}:${identifier}`;
    await redis.del(key);
  }
}

export const redisRateLimitService = new RedisRateLimitService();
