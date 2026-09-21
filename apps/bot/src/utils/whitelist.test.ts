import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizePhone,
  getAllowedCustomerPhones,
  isCustomerAllowed,
} from './whitelist';

// ---------------------------------------------------------------------------
// Mock Redis — isCustomerAllowed now uses Redis SISMEMBER
// ---------------------------------------------------------------------------
const mockSismember = vi.fn<(key: string, member: string) => Promise<0 | 1>>();

vi.mock('../bot/use-redis-auth-state.js', () => ({
  getRedisClient: () => ({
    sismember: mockSismember,
  }),
}));

describe('Customer Whitelist Guardrail', () => {
  const originalEnv = process.env.ALLOWED_CUSTOMER_PHONES;

  beforeEach(() => {
    delete process.env.ALLOWED_CUSTOMER_PHONES;
    mockSismember.mockReset();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ALLOWED_CUSTOMER_PHONES = originalEnv;
    } else {
      delete process.env.ALLOWED_CUSTOMER_PHONES;
    }
  });

  describe('normalizePhone', () => {
    it('normalizes local Indonesian number starting with 0 to 62', () => {
      expect(normalizePhone('08123456789')).toBe('628123456789');
    });

    it('strips non-digits and preserves 62 prefix', () => {
      expect(normalizePhone('+62 812-3456-789')).toBe('628123456789');
    });

    it('handles clean 62 prefix correctly', () => {
      expect(normalizePhone('6285158858310')).toBe('6285158858310');
    });
  });

  describe('getAllowedCustomerPhones', () => {
    it('returns empty Set when env var is undefined or empty', () => {
      expect(getAllowedCustomerPhones().size).toBe(0);
      process.env.ALLOWED_CUSTOMER_PHONES = '   ';
      expect(getAllowedCustomerPhones().size).toBe(0);
    });

    it('parses comma-separated numbers and normalizes them', () => {
      process.env.ALLOWED_CUSTOMER_PHONES = '08123456789, +62 898-7654-321 ';
      const allowed = getAllowedCustomerPhones();
      expect(allowed.has('628123456789')).toBe(true);
      expect(allowed.has('628987654321')).toBe(true);
      expect(allowed.size).toBe(2);
    });
  });

  describe('isCustomerAllowed (Redis-backed)', () => {
    it('returns false when Redis returns 0 (not member)', async () => {
      mockSismember.mockResolvedValue(0);
      expect(await isCustomerAllowed('628123456789')).toBe(false);
    });

    it('returns true when Redis returns 1 (member)', async () => {
      mockSismember.mockResolvedValue(1);
      expect(await isCustomerAllowed('628123456789')).toBe(true);
    });

    it('normalizes phone before querying Redis', async () => {
      mockSismember.mockResolvedValue(1);
      await isCustomerAllowed('08123456789');
      expect(mockSismember).toHaveBeenCalledWith('whatsapp:allowed_phones', '628123456789');
    });

    it('fails closed when Redis throws', async () => {
      mockSismember.mockRejectedValue(new Error('ECONNREFUSED'));
      expect(await isCustomerAllowed('628123456789')).toBe(false);
    });
  });
});
