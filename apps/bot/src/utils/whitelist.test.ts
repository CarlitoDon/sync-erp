import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAllowedCustomerPhones,
  isCustomerAllowed,
  seedWhitelistFromEnv,
} from './whitelist';
import { normalizePhone } from '@sync-erp/shared/whatsapp';

// ---------------------------------------------------------------------------
// Mock Redis — isCustomerAllowed and seedWhitelistFromEnv use Redis
// ---------------------------------------------------------------------------
const mockSismember = vi.fn<(key: string, member: string) => Promise<0 | 1>>();
const mockSrem = vi.fn();
const mockSadd = vi.fn();
const mockDel = vi.fn();

vi.mock('../bot/use-redis-auth-state.js', () => ({
  getRedisClient: () => ({
    sismember: mockSismember,
    srem: mockSrem,
    sadd: mockSadd,
    del: mockDel,
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

    it('unconditionally returns false for Admin 1 (+6281249182155) even if Redis says member', async () => {
      mockSismember.mockResolvedValue(1);
      expect(await isCustomerAllowed('6281249182155')).toBe(false);
      expect(await isCustomerAllowed('081249182155')).toBe(false);
      expect(await isCustomerAllowed('+62 812-4918-2155')).toBe(false);
      // Redis should NOT even be called because staff check short-circuits
      expect(mockSismember).not.toHaveBeenCalled();
    });

    it('unconditionally returns false for other internal staff and office', async () => {
      mockSismember.mockResolvedValue(1);
      expect(await isCustomerAllowed('6285158858310')).toBe(false); // Don
      expect(await isCustomerAllowed('628987257284')).toBe(false); // Hesy
      expect(await isCustomerAllowed('6285229092368')).toBe(false); // Admin 2
      expect(await isCustomerAllowed('6281326175144')).toBe(false); // Admin 3
      expect(mockSismember).not.toHaveBeenCalled();
    });
  });

  describe('Internal Staff Filtering in getAllowedCustomerPhones', () => {
    it('filters out internal staff numbers from env variable', () => {
      process.env.ALLOWED_CUSTOMER_PHONES =
        '628123456789, 6281249182155, 085158858310, 628999999999';
      const allowed = getAllowedCustomerPhones();
      expect(allowed.has('628123456789')).toBe(true);
      expect(allowed.has('628999999999')).toBe(true);
      expect(allowed.has('6281249182155')).toBe(false); // Admin 1 filtered
      expect(allowed.has('6285158858310')).toBe(false); // Don filtered
      expect(allowed.size).toBe(2);
    });
  });

  describe('seedWhitelistFromEnv', () => {
    it('purges internal staff phones and LIDs via srem and deletes lingering keys', async () => {
      mockSrem.mockResolvedValue(1);
      mockDel.mockResolvedValue(1);
      mockSadd.mockResolvedValue(1);

      process.env.ALLOWED_CUSTOMER_PHONES = '08123456789, 6281249182155'; // Customer + Admin 1

      await seedWhitelistFromEnv();

      // 1. Verify srem called with WHITELIST_KEY including Admin 1 phone and LID
      expect(mockSrem).toHaveBeenCalled();
      const sremArgs = mockSrem.mock.calls[0];
      expect(sremArgs[0]).toBe('whatsapp:allowed_phones');
      expect(sremArgs).toContain('6281249182155'); // Admin 1 international
      expect(sremArgs).toContain('081249182155');  // Admin 1 local
      expect(sremArgs).toContain('75432611295262'); // Admin 1 LID

      // 2. Verify del called to clean staff residual keys
      expect(mockDel).toHaveBeenCalledWith('whatsapp:chat_history:6281249182155');
      expect(mockDel).toHaveBeenCalledWith('whatsapp:session_mode:6281249182155');

      // 3. Verify sadd called ONLY with valid customer phone (Admin 1 excluded)
      expect(mockSadd).toHaveBeenCalledWith('whatsapp:allowed_phones', '628123456789');
      const saddArgs = mockSadd.mock.calls[0];
      expect(saddArgs).not.toContain('6281249182155');
    });
  });
});
