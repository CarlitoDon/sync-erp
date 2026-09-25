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
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.ALLOWED_CUSTOMER_PHONES;
    delete process.env.BOT_WHITELIST_ENABLED;
    delete process.env.WHITELIST_ENABLED;
    delete process.env.BOT_TEST_NUMBERS;
    delete process.env.TEST_CUSTOMER_PHONES;
    delete process.env.STAFF_PROTECTION_ENABLED;
    delete process.env.BOT_IGNORE_STAFF;
    mockSismember.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
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

    it('allows numbers that exist in Redis whitelist even if internal staff', async () => {
      mockSismember.mockResolvedValue(1);
      expect(await isCustomerAllowed('6285158858310')).toBe(true); // Don in Redis
      expect(await isCustomerAllowed('085158858310')).toBe(true);
    });

    it('returns false for internal staff when NOT in Redis whitelist', async () => {
      mockSismember.mockResolvedValue(0);
      expect(await isCustomerAllowed('6281249182155')).toBe(false); // Admin 1
      expect(await isCustomerAllowed('628987257284')).toBe(false);  // Hesy
      expect(await isCustomerAllowed('6285229092368')).toBe(false); // Admin 2
    });

    it('allows test numbers even if they belong to internal staff (bypasses staff check)', async () => {
      process.env.BOT_TEST_NUMBERS = '085158858310';
      // 085158858310 is Don / Owner in INTERNAL_STAFF_PHONES
      expect(await isCustomerAllowed('6285158858310')).toBe(true);
      expect(await isCustomerAllowed('085158858310')).toBe(true);
    });

    it('permits all non-staff customers when BOT_WHITELIST_ENABLED is false (open mode)', async () => {
      process.env.BOT_WHITELIST_ENABLED = 'false';
      expect(await isCustomerAllowed('628999888777')).toBe(true);
      // Staff still blocked if staffProtectionEnabled is true
      expect(await isCustomerAllowed('6281249182155')).toBe(false);
    });

    it('permits staff when STAFF_PROTECTION_ENABLED is false and whitelist is disabled', async () => {
      process.env.BOT_WHITELIST_ENABLED = 'false';
      process.env.STAFF_PROTECTION_ENABLED = 'false';
      expect(await isCustomerAllowed('6281249182155')).toBe(true);
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
    it('seeds allowed customer phones into Redis via sadd', async () => {
      mockSadd.mockResolvedValue(1);

      process.env.ALLOWED_CUSTOMER_PHONES = '08123456789, 6281249182155'; // Customer + Admin 1

      await seedWhitelistFromEnv();

      // Verify sadd called with valid customer phone (Admin 1 filtered from env)
      expect(mockSadd).toHaveBeenCalledWith('whatsapp:allowed_phones', '628123456789');
      const saddArgs = mockSadd.mock.calls[0];
      expect(saddArgs).not.toContain('6281249182155');
    });
  });
});
