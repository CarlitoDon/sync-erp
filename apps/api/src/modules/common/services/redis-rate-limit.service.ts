/**
 * Redis-backed rate limit service.
 *
 * Replaces the in-memory PublicRateLimitService for production use.
 * Rate limits persist across API restarts and work across multiple instances.
 *
 * Uses Redis EXPIRE for automatic window cleanup — no manual sweep needed.
 *
 * FAIL-CLOSED: when Redis is unavailable, consume() throws so callers cannot
 * accidentally bypass rate limiting during an outage. The in-memory
 * PublicRateLimitService remains available as an explicit degraded fallback
 * for public endpoints that choose to keep working during an outage (see
 * AdaptiveRateLimitService), but the Redis primitive itself never silently
 * allows traffic.
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

/**
 * Parse the [count, ttl] tuple returned by the Lua script.
 *
 * A malformed response (wrong shape or non-finite numbers) throws so the
 * caller fails closed instead of silently skipping rate limiting. ioredis
 * returns numbers for numeric replies; string digits are tolerated for
 * robustness.
 */
function parseCounterResult(raw: unknown): [number, number] {
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error('Rate limit Lua script returned an unexpected shape');
  }

  const count = typeof raw[0] === 'string' ? Number(raw[0]) : raw[0];
  const ttl = typeof raw[1] === 'string' ? Number(raw[1]) : raw[1];

  if (
    typeof count !== 'number' ||
    typeof ttl !== 'number' ||
    !Number.isFinite(count) ||
    !Number.isFinite(ttl) ||
    count < 0
  ) {
    throw new Error('Rate limit Lua script returned invalid counters');
  }

  return [count, ttl];
}

export class RedisRateLimitService {
  /**
   * Consume one attempt for the given identifier + config.
   *
   * Uses a single Lua script for atomicity:
   *   1. INCR the counter
   *   2. If counter == 1, set EXPIRE (start the window)
   *   3. Return current count and TTL
   *
   * On Redis failure this throws (fail-closed) rather than allowing the
   * request through without rate limiting. Callers that require availability
   * during an outage must choose an explicit degraded policy (e.g. the
   * in-memory fallback in AdaptiveRateLimitService) instead of relying on a
   * silent bypass here.
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

    const raw = await redis.eval(luaScript, 1, key, windowSeconds);
    const result = parseCounterResult(raw);

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
