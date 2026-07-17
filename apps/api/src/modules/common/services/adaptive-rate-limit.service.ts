/**
 * Hybrid rate limit service.
 *
 * Attempts Redis-backed rate limiting first.
 * Falls back to in-memory if Redis is unavailable (degraded mode).
 *
 * This ensures the API remains functional during Redis outages
 * while providing persistent rate limiting in production.
 */

import { redisRateLimitService } from './redis-rate-limit.service';
import { PublicRateLimitService, type PublicRateLimitConfig, type PublicRateLimitResult as InMemoryResult } from './public-rate-limit.service';

const inMemoryFallback = new PublicRateLimitService();

// Re-export types for backward compatibility
export type { PublicRateLimitConfig, PublicRateLimitResult } from './public-rate-limit.service';

/**
 * Adaptive rate limiter that uses Redis when available,
 * falls back to in-memory otherwise.
 */
export class AdaptiveRateLimitService {
  private redisAvailable = true;
  private lastRedisCheck = 0;
  private readonly REDIS_CHECK_INTERVAL = 30_000; // Re-check every 30s

  /**
   * Consume one rate limit attempt.
   * Tries Redis first, falls back to in-memory on failure.
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
        console.warn('[RateLimit] Redis unavailable, falling back to in-memory:', (err as Error).message);
        this.redisAvailable = false;
        this.lastRedisCheck = Date.now();
      }
    }

    // In-memory fallback
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

    // In-memory doesn't have peek; use consume with a dummy count
    // For now, just return allowed
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
