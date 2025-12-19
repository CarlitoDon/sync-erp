import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  mockAccountRepository,
  mockJournalRepository,
  resetRepositoryMocks,
} from '../mocks/repositories.mock';

// Mock AccountRepository
vi.mock(
  '@modules/accounting/repositories/account.repository',
  () => ({
    AccountRepository: function () {
      return mockAccountRepository;
    },
  })
);

// Mock JournalRepository
vi.mock(
  '@modules/accounting/repositories/journal.repository',
  () => ({
    JournalRepository: function () {
      return mockJournalRepository;
    },
  })
);

// Import after mocking
import { ReportService } from '@modules/accounting/services/report.service';

describe('ReportService', () => {
  let service: ReportService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetRepositoryMocks();
    service = new ReportService();
  });

  describe('getTrialBalance', () => {
    it('should generate trial balance with all accounts', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          code: '1000',
          name: 'Cash',
          type: 'ASSET',
          isActive: true,
        },
        {
          id: 'acc-2',
          code: '2000',
          name: 'Accounts Payable',
          type: 'LIABILITY',
          isActive: true,
        },
      ];

      mockAccountRepository.findAll.mockResolvedValue(mockAccounts);
      mockJournalRepository.aggregateAccountSum
        .mockResolvedValueOnce({ _sum: { debit: 1000, credit: 200 } }) // Cash
        .mockResolvedValueOnce({ _sum: { debit: 100, credit: 500 } }); // AP

      const result = await service.getTrialBalance(companyId);

      expect(result.entries).toHaveLength(2);
      expect(result.totalDebit).toBe(1100);
      expect(result.totalCredit).toBe(700);
    });

    it('should mark as balanced when debits equal credits', async () => {
      mockAccountRepository.findAll.mockResolvedValue([
        {
          id: 'acc-1',
          code: '1000',
          name: 'Cash',
          type: 'ASSET',
          isActive: true,
        },
      ]);
      mockJournalRepository.aggregateAccountSum.mockResolvedValue({
        _sum: { debit: 1000, credit: 1000 },
      });

      const result = await service.getTrialBalance(companyId);

      expect(result.isBalanced).toBe(true);
    });

    it('should exclude accounts with no activity', async () => {
      mockAccountRepository.findAll.mockResolvedValue([
        {
          id: 'acc-1',
          code: '1000',
          name: 'Cash',
          type: 'ASSET',
          isActive: true,
        },
      ]);
      mockJournalRepository.aggregateAccountSum.mockResolvedValue({
        _sum: { debit: 0, credit: 0 },
      });

      const result = await service.getTrialBalance(companyId);

      expect(result.entries).toHaveLength(0);
    });
  });

  describe('getGeneralLedger', () => {
    it('should generate general ledger for an account', async () => {
      const mockAccount = {
        id: 'acc-1',
        code: '1000',
        name: 'Cash',
        type: 'ASSET',
      };
      const mockJournalLines = [
        {
          id: 'line-1',
          accountId: 'acc-1',
          debit: 1000,
          credit: 0,
          journal: {
            date: new Date('2025-01-01'),
            reference: 'INV-001',
            memo: 'Sale',
          },
        },
        {
          id: 'line-2',
          accountId: 'acc-1',
          debit: 0,
          credit: 500,
          journal: {
            date: new Date('2025-01-02'),
            reference: 'PMT-001',
            memo: 'Payment',
          },
        },
      ];

      mockAccountRepository.findById.mockResolvedValue(mockAccount);
      mockJournalRepository.getOpeningBalanceSum.mockResolvedValue({
        _sum: { debit: 0, credit: 0 },
      });
      mockJournalRepository.findLinesByAccount.mockResolvedValue(
        mockJournalLines
      );

      const result = await service.getGeneralLedger(
        companyId,
        'acc-1'
      );

      expect(result.account.code).toBe('1000');
      expect(result.entries).toHaveLength(2);
      expect(result.closingBalance).toBe(500); // 1000 - 500
    });

    it('should throw error if account not found', async () => {
      mockAccountRepository.findById.mockResolvedValue(null);

      await expect(
        service.getGeneralLedger(companyId, 'nonexistent')
      ).rejects.toThrow('Account not found');
    });

    it('should calculate opening balance when startDate provided', async () => {
      const mockAccount = {
        id: 'acc-1',
        code: '1000',
        name: 'Cash',
        type: 'ASSET',
      };

      mockAccountRepository.findById.mockResolvedValue(mockAccount);
      mockJournalRepository.getOpeningBalanceSum.mockResolvedValue({
        _sum: { debit: 5000, credit: 2000 },
      });
      mockJournalRepository.findLinesByAccount.mockResolvedValue([]);

      const result = await service.getGeneralLedger(
        companyId,
        'acc-1',
        new Date('2025-01-01'),
        new Date('2025-12-31')
      );

      expect(result.openingBalance).toBe(3000); // 5000 - 2000
    });
  });

  describe('getIncomeStatement', () => {
    it('should calculate income statement', async () => {
      // Revenue: credits - debits = 10000 - 1000 = 9000
      // Expenses: debits - credits = 5000 - 500 = 4500
      mockJournalRepository.aggregateTypeSum
        .mockResolvedValueOnce({
          _sum: { credit: 10000, debit: 1000 },
        }) // Revenue
        .mockResolvedValueOnce({
          _sum: { debit: 5000, credit: 500 },
        }); // Expenses

      const result = await service.getIncomeStatement(
        companyId,
        new Date('2025-01-01'),
        new Date('2025-12-31')
      );

      expect(result.revenue).toBe(9000);
      expect(result.expenses).toBe(4500);
      expect(result.netIncome).toBe(4500); // 9000 - 4500
    });

    it('should handle periods with no activity', async () => {
      mockJournalRepository.aggregateTypeSum.mockResolvedValue({
        _sum: { credit: null, debit: null },
      });

      const result = await service.getIncomeStatement(
        companyId,
        new Date('2025-01-01'),
        new Date('2025-12-31')
      );

      expect(result.revenue).toBe(0);
      expect(result.expenses).toBe(0);
      expect(result.netIncome).toBe(0);
    });
  });
});
