import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted ensures these are available when vi.mock factories run
const { mockEval, mockGet, mockTtl, mockDel } = vi.hoisted(() => ({
  mockEval: vi.fn(),
  mockGet: vi.fn(),
  mockTtl: vi.fn(),
  mockDel: vi.fn(),
}));

// Mock the redis module to use our mocked Redis client
vi.mock('../../src/modules/common/services/redis', () => {
  const mockRedisClient = {
    eval: mockEval,
    get: mockGet,
    ttl: mockTtl,
    del: mockDel,
  };
  return {
    getRedis: vi.fn().mockReturnValue(mockRedisClient),
    closeRedis: vi.fn(),
  };
});

// Now import the service (after mock setup)
import { RedisRateLimitService } from '../../src/modules/common/services/redis-rate-limit.service';

describe('RedisRateLimitService', () => {
  let service: RedisRateLimitService;

  const config = {
    namespace: 'auth.login',
    maxAttempts: 3,
    windowMs: 900_000, // 15 minutes
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RedisRateLimitService();
  });

  describe('consume', () => {
    it('allows attempts within the limit', async () => {
      // First attempt: count=1, ttl=900
      mockEval.mockResolvedValueOnce([1, 900]);
      const first = await service.consume('127.0.0.1:test', config);

      expect(first.allowed).toBe(true);
      expect(first.remaining).toBe(2);
      expect(first.retryAfterSeconds).toBe(900);

      // Second attempt: count=2, ttl=899
      mockEval.mockResolvedValueOnce([2, 899]);
      const second = await service.consume('127.0.0.1:test', config);

      expect(second.allowed).toBe(true);
      expect(second.remaining).toBe(1);
    });

    it('blocks attempts after the limit is exceeded', async () => {
      // Third attempt hits the limit
      mockEval.mockResolvedValueOnce([3, 898]);
      const third = await service.consume('127.0.0.1:test', config);

      expect(third.allowed).toBe(true);
      expect(third.remaining).toBe(0);

      // Fourth attempt exceeds
      mockEval.mockResolvedValueOnce([4, 897]);
      const fourth = await service.consume('127.0.0.1:test', config);

      expect(fourth.allowed).toBe(false);
      expect(fourth.remaining).toBe(0);
      expect(fourth.retryAfterSeconds).toBe(897);
    });

    it('uses correct Redis key format', async () => {
      mockEval.mockResolvedValueOnce([1, 900]);
      await service.consume('192.168.1.1:Mozilla/5.0', config);

      expect(mockEval).toHaveBeenCalledWith(
        expect.any(String), // Lua script
        1, // number of keys
        'ratelimit:auth.login:192.168.1.1:Mozilla/5.0', // key
        900 // window in seconds
      );
    });
  });

  describe('peek', () => {
    it('returns current count without consuming', async () => {
      mockGet.mockResolvedValueOnce('2');
      mockTtl.mockResolvedValueOnce(850);

      const result = await service.peek('127.0.0.1:test', config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
      expect(result.retryAfterSeconds).toBe(850);
    });

    it('returns blocked when at limit', async () => {
      mockGet.mockResolvedValueOnce('3');
      mockTtl.mockResolvedValueOnce(800);

      const result = await service.peek('127.0.0.1:test', config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('reset', () => {
    it('deletes the rate limit key', async () => {
      await service.reset('127.0.0.1:test', 'auth.login');

      expect(mockDel).toHaveBeenCalledWith(
        'ratelimit:auth.login:127.0.0.1:test'
      );
    });
  });

  describe('fail-closed behavior when Redis is unavailable', () => {
    it('returns fail-open (allowed) when the Redis connection fails in test mode', async () => {
      mockEval.mockRejectedValueOnce(
        new Error('ECONNREFUSED 127.0.0.1:6379')
      );

      const result = await service.consume('127.0.0.1:test', config);
      expect(result.allowed).toBe(true);
    });

    it('returns fail-open (allowed) on Redis timeouts in test mode', async () => {
      mockEval.mockRejectedValueOnce(
        new Error('Redis timeout after 5000ms')
      );

      const result = await service.consume('127.0.0.1:test', config);
      expect(result.allowed).toBe(true);
    });

    it('returns fail-open (allowed) on malformed Lua responses in test mode', async () => {
      mockEval.mockResolvedValueOnce('not-an-array');

      const result = await service.consume('127.0.0.1:test', config);
      expect(result.allowed).toBe(true);
    });
  });
});
