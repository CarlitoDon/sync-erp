export interface PublicRateLimitConfig {
  namespace: string;
  maxAttempts: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface PublicRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class PublicRateLimitService {
  private readonly store = new Map<string, RateLimitEntry>();

  consume(
    identifier: string,
    config: PublicRateLimitConfig,
    now = Date.now()
  ): PublicRateLimitResult {
    const key = `${config.namespace}:${identifier}`;
    const current = this.store.get(key);

    if (!current || current.resetAt <= now) {
      this.store.set(key, {
        count: 1,
        resetAt: now + config.windowMs,
      });

      return {
        allowed: true,
        remaining: Math.max(config.maxAttempts - 1, 0),
        retryAfterSeconds: Math.ceil(config.windowMs / 1000),
      };
    }

    current.count += 1;
    this.store.set(key, current);

    const retryAfterSeconds = Math.max(
      Math.ceil((current.resetAt - now) / 1000),
      1
    );

    if (current.count > config.maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(config.maxAttempts - current.count, 0),
      retryAfterSeconds,
    };
  }

  clear() {
    this.store.clear();
  }
}

export const publicRateLimitService =
  new PublicRateLimitService();
