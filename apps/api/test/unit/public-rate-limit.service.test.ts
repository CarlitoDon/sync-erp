import { beforeEach, describe, expect, it } from 'vitest';
import { PublicRateLimitService } from '../../src/modules/common/services/public-rate-limit.service';

describe('PublicRateLimitService Unit', () => {
  let service: PublicRateLimitService;

  const config = {
    namespace: 'auth.login',
    maxAttempts: 2,
    windowMs: 60_000,
  };

  beforeEach(() => {
    service = new PublicRateLimitService();
  });

  it('allows attempts within the limit', () => {
    const first = service.consume('127.0.0.1:test-agent', config, 0);
    const second = service.consume(
      '127.0.0.1:test-agent',
      config,
      1_000
    );

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
  });

  it('blocks attempts after the limit is exceeded', () => {
    service.consume('127.0.0.1:test-agent', config, 0);
    service.consume('127.0.0.1:test-agent', config, 1_000);
    const blocked = service.consume(
      '127.0.0.1:test-agent',
      config,
      2_000
    );

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets the counter after the window expires', () => {
    service.consume('127.0.0.1:test-agent', config, 0);
    service.consume('127.0.0.1:test-agent', config, 1_000);

    const resetAttempt = service.consume(
      '127.0.0.1:test-agent',
      config,
      61_000
    );

    expect(resetAttempt.allowed).toBe(true);
    expect(resetAttempt.remaining).toBe(1);
  });
});
