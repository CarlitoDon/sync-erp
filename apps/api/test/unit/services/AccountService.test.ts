import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

// Mock the database module
vi.mock('@sync-erp/database', () => ({
  prisma: mockPrisma,
  AccountType: {
    ASSET: 'ASSET',
    LIABILITY: 'LIABILITY',
    EQUITY: 'EQUITY',
    REVENUE: 'REVENUE',
    EXPENSE: 'EXPENSE',
  },
}));

// Import after mocking
import { AccountService } from '../../../src/services/AccountService';

describe('AccountService', () => {
  let service: AccountService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetMocks();
    service = new AccountService();
  });

  describe('create', () => {
    it('should create a new account', async () => {
      const mockAccount = {
        id: 'acc-1',
        companyId,
        code: '1100',
        name: 'Cash',
        type: 'ASSET',
      };

      mockPrisma.account.create.mockResolvedValue(mockAccount);

      const result = await service.create(companyId, {
        code: '1100',
        name: 'Cash',
        type: 'ASSET' as any,
      });

      expect(result).toEqual(mockAccount);
      expect(mockPrisma.account.create).toHaveBeenCalledWith({
        data: {
          companyId,
          code: '1100',
          name: 'Cash',
          type: 'ASSET',
        },
      });
    });
  });

  describe('getById', () => {
    it('should return an account by ID', async () => {
      const mockAccount = { id: 'acc-1', companyId, code: '1100', name: 'Cash' };
      mockPrisma.account.findFirst.mockResolvedValue(mockAccount);

      const result = await service.getById('acc-1', companyId);

      expect(result).toEqual(mockAccount);
    });

    it('should return null for non-existent account', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      const result = await service.getById('nonexistent', companyId);

      expect(result).toBeNull();
    });
  });

  describe('getByCode', () => {
    it('should return an account by code', async () => {
      const mockAccount = { id: 'acc-1', companyId, code: '1100', name: 'Cash' };
      mockPrisma.account.findFirst.mockResolvedValue(mockAccount);

      const result = await service.getByCode(companyId, '1100');

      expect(result).toEqual(mockAccount);
      expect(mockPrisma.account.findFirst).toHaveBeenCalledWith({
        where: { companyId, code: '1100' },
      });
    });
  });

  describe('list', () => {
    it('should list all accounts', async () => {
      const mockAccounts = [
        { id: 'acc-1', code: '1100', name: 'Cash' },
        { id: 'acc-2', code: '2100', name: 'AP' },
      ];
      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.list(companyId);

      expect(result).toHaveLength(2);
    });

    it('should filter by account type', async () => {
      const mockAccounts = [{ id: 'acc-1', code: '1100', type: 'ASSET' }];
      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.list(companyId, 'ASSET' as any);

      expect(result).toHaveLength(1);
      expect(mockPrisma.account.findMany).toHaveBeenCalledWith({
        where: { companyId, type: 'ASSET' },
        orderBy: { code: 'asc' },
      });
    });
  });

  describe('update', () => {
    it('should update an account', async () => {
      const updatedAccount = { id: 'acc-1', name: 'Cash on Hand', isActive: true };
      mockPrisma.account.update.mockResolvedValue(updatedAccount);

      const result = await service.update('acc-1', companyId, { name: 'Cash on Hand' });

      expect(result.name).toBe('Cash on Hand');
    });
  });

  describe('seedDefaultAccounts', () => {
    it('should seed default accounts for a new company', async () => {
      // All accounts don't exist yet
      mockPrisma.account.findFirst.mockResolvedValue(null);
      mockPrisma.account.create.mockImplementation((args) =>
        Promise.resolve({
          id: `acc-${args.data.code}`,
          ...args.data,
        })
      );

      const result = await service.seedDefaultAccounts(companyId);

      // Should create all 19 default accounts
      expect(result.length).toBe(19);
      expect(mockPrisma.account.create).toHaveBeenCalledTimes(19);
    });

    it('should skip existing accounts when seeding', async () => {
      // First account exists, rest don't
      mockPrisma.account.findFirst
        .mockResolvedValueOnce({ id: 'existing', code: '1100', name: 'Cash' })
        .mockResolvedValue(null);

      mockPrisma.account.create.mockImplementation((args) =>
        Promise.resolve({
          id: `acc-${args.data.code}`,
          ...args.data,
        })
      );

      const result = await service.seedDefaultAccounts(companyId);

      // Should create 18 accounts (skipping the existing one)
      expect(result.length).toBe(18);
    });
  });
});
