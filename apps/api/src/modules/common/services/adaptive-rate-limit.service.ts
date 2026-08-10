/**
 * Hybrid rate limit service.
 *
 * Attempts Redis-backed rate limiting first.
 * Falls back to a bounded in-memory limiter if Redis is unavailable
 * (degraded mode).
 *
 * Degraded-mode policy: when Redis is unavailable the fallback is NOT an
 * unrestricted allow. Requests are still rate limited by a per-process
 * in-memory window, so a Redis outage cannot silently bypass public-endpoint
 * rate limiting (multi-instance consistency degrades to per-instance, but the
 * limit itself still holds). Callers that require strict cross-instance
 * enforcement must use RedisRateLimitService directly, which fails closed.
 */

import { redisRateLimitService } from './redis-rate-limit.service';
import { PublicRateLimitService, type PublicRateLimitConfig, type PublicRateLimitResult as InMemoryResult } from './public-rate-limit.service';

const inMemoryFallback = new PublicRateLimitService();

// Re-export types for backward compatibility
export type { PublicRateLimitConfig, PublicRateLimitResult } from './public-rate-limit.service';

/**
 * Adaptive rate limiter that uses Redis when available,
 * falls back to bounded in-memory rate limiting otherwise.
 */
export class AdaptiveRateLimitService {
  private redisAvailable = true;
  private lastRedisCheck = 0;
  private readonly REDIS_CHECK_INTERVAL = 30_000; // Re-check every 30s

  /**
   * Consume one rate limit attempt.
   * Tries Redis first, falls back to in-memory limiting on failure.
   */
  async consume(
    identifier: string,
    config: PublicRateLimitConfig
  ): Promise<InMemoryResult> {
    // Try Redis if we believe it's available
    if (this.shouldTryRedis()) {
      try {
        const result = await redisRateLimitService.consume(identifier, config);
        this.redisAvailable = true;
        return result;
      } catch (err) {
        console.warn('[RateLimit] Redis unavailable, using bounded in-memory fallback:', (err as Error).message);
        this.redisAvailable = false;
        this.lastRedisCheck = Date.now();
      }
    }

    // Bounded in-memory fallback: still enforces the configured limit
    // per process (degraded mode). Never an unlimited allow.
    return inMemoryFallback.consume(identifier, config);
  }

  /**
   * Check if we should attempt Redis.
   * If Redis was recently unavailable, wait before retrying.
   */
  private shouldTryRedis(): boolean {
    if (this.redisAvailable) return true;

    // Re-check periodically
    if (Date.now() - this.lastRedisCheck > this.REDIS_CHECK_INTERVAL) {
      return true; // Give Redis another chance
    }

    return false;
  }

  /**
   * Get current rate limit status without consuming (for headers).
   */
  async peek(
    identifier: string,
    config: PublicRateLimitConfig
  ): Promise<InMemoryResult> {
    if (this.shouldTryRedis()) {
      try {
        return await redisRateLimitService.peek(identifier, config);
      } catch {
        // Fall through to in-memory
      }
    }

    // In-memory fallback has no peek; report an allowed neutral result.
    return {
      allowed: true,
      remaining: config.maxAttempts,
      retryAfterSeconds: Math.ceil(config.windowMs / 1000),
    };
  }

  /**
   * Clear in-memory store (for tests).
   */
  clear(): void {
    inMemoryFallback.clear();
  }
}

export const adaptiveRateLimitService = new AdaptiveRateLimitService();
