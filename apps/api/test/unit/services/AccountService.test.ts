import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  mockAccountRepository,
  resetRepositoryMocks,
} from '../mocks/repositories.mock';

// Mock the AccountRepository module
vi.mock(
  '../../../src/modules/accounting/repositories/account.repository',
  () => ({
    AccountRepository: vi
      .fn()
      .mockImplementation(() => mockAccountRepository),
  })
);

// Import after mocking
import { AccountService } from '../../../src/modules/accounting/services/account.service';

describe('AccountService', () => {
  let service: AccountService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetRepositoryMocks();
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

      mockAccountRepository.create.mockResolvedValue(mockAccount);

      const result = await service.create(companyId, {
        code: '1100',
        name: 'Cash',
        type: 'ASSET' as any,
      });

      expect(result).toEqual(mockAccount);
      expect(mockAccountRepository.create).toHaveBeenCalledWith({
        company: { connect: { id: companyId } },
        code: '1100',
        name: 'Cash',
        type: 'ASSET',
      });
    });
  });

  describe('getById', () => {
    it('should return an account by ID', async () => {
      const mockAccount = {
        id: 'acc-1',
        companyId,
        code: '1100',
        name: 'Cash',
      };
      mockAccountRepository.findById.mockResolvedValue(mockAccount);

      const result = await service.getById('acc-1', companyId);

      expect(result).toEqual(mockAccount);
    });

    it('should return null for non-existent account', async () => {
      mockAccountRepository.findById.mockResolvedValue(null);

      const result = await service.getById('nonexistent', companyId);

      expect(result).toBeNull();
    });
  });

  describe('getByCode', () => {
    it('should return an account by code', async () => {
      const mockAccount = {
        id: 'acc-1',
        companyId,
        code: '1100',
        name: 'Cash',
      };
      mockAccountRepository.findByCode.mockResolvedValue(mockAccount);

      const result = await service.getByCode(companyId, '1100');

      expect(result).toEqual(mockAccount);
      expect(mockAccountRepository.findByCode).toHaveBeenCalledWith(
        '1100',
        companyId
      );
    });
  });

  describe('list', () => {
    it('should list all accounts', async () => {
      const mockAccounts = [
        { id: 'acc-1', code: '1100', name: 'Cash' },
        { id: 'acc-2', code: '2100', name: 'AP' },
      ];
      mockAccountRepository.findAll.mockResolvedValue(mockAccounts);

      const result = await service.list(companyId);

      expect(result).toHaveLength(2);
    });

    it('should filter by account type', async () => {
      const mockAccounts = [
        { id: 'acc-1', code: '1100', type: 'ASSET' },
      ];
      mockAccountRepository.findAll.mockResolvedValue(mockAccounts);

      const result = await service.list(companyId, 'ASSET' as any);

      expect(result).toHaveLength(1);
      expect(mockAccountRepository.findAll).toHaveBeenCalledWith(
        companyId,
        'ASSET'
      );
    });
  });

  describe('update', () => {
    it('should update an account', async () => {
      const existingAccount = {
        id: 'acc-1',
        companyId,
        code: '1100',
      };
      const updatedAccount = {
        id: 'acc-1',
        name: 'Cash on Hand',
        isActive: true,
      };
      mockAccountRepository.findById.mockResolvedValue(
        existingAccount
      );
      mockAccountRepository.update.mockResolvedValue(updatedAccount);

      const result = await service.update('acc-1', companyId, {
        name: 'Cash on Hand',
      });

      expect(result.name).toBe('Cash on Hand');
    });

    it('should throw error if account not found', async () => {
      mockAccountRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', companyId, { name: 'New' })
      ).rejects.toThrow('Account not found');
    });
  });

  describe('seedDefaultAccounts', () => {
    it('should seed default accounts for a new company', async () => {
      // All accounts don't exist yet
      mockAccountRepository.findByCode.mockResolvedValue(null);
      mockAccountRepository.create.mockImplementation((data) =>
        Promise.resolve({
          id: `acc-${data.code}`,
          companyId,
          code: data.code,
          name: data.name,
          type: data.type,
        })
      );

      const result = await service.seedDefaultAccounts(companyId);

      // Should create all 20 default accounts
      expect(result.length).toBe(20);
      expect(mockAccountRepository.create).toHaveBeenCalledTimes(20);
    });

    it('should skip existing accounts when seeding', async () => {
      // First account exists, rest don't
      mockAccountRepository.findByCode
        .mockResolvedValueOnce({
          id: 'existing',
          code: '1100',
          name: 'Cash',
        })
        .mockResolvedValue(null);

      mockAccountRepository.create.mockImplementation((data) =>
        Promise.resolve({
          id: `acc-${data.code}`,
          companyId,
          code: data.code,
          name: data.name,
          type: data.type,
        })
      );

      const result = await service.seedDefaultAccounts(companyId);

      // Should create 19 accounts (skipping the existing one)
      expect(result.length).toBe(19);
    });
  });
});
