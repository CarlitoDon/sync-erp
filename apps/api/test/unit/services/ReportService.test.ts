import { vi } from 'vitest';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

// Mock the database module

// Import after mocking
import { ReportService } from '../../../src/services/ReportService';

describe('ReportService', () => {
  let service: ReportService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetMocks();
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

      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);
      mockPrisma.journalLine.aggregate
        .mockResolvedValueOnce({ _sum: { debit: 1000, credit: 200 } }) // Cash
        .mockResolvedValueOnce({ _sum: { debit: 100, credit: 500 } }); // AP

      const result = await service.getTrialBalance(companyId);

      expect(result.entries).toHaveLength(2);
      expect(result.totalDebit).toBe(1100);
      expect(result.totalCredit).toBe(700);
    });

    it('should mark as balanced when debits equal credits', async () => {
      mockPrisma.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          code: '1000',
          name: 'Cash',
          type: 'ASSET',
          isActive: true,
        },
      ]);
      mockPrisma.journalLine.aggregate.mockResolvedValue({
        _sum: { debit: 1000, credit: 1000 },
      });

      const result = await service.getTrialBalance(companyId);

      expect(result.isBalanced).toBe(true);
    });

    it('should exclude accounts with no activity', async () => {
      mockPrisma.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          code: '1000',
          name: 'Cash',
          type: 'ASSET',
          isActive: true,
        },
      ]);
      mockPrisma.journalLine.aggregate.mockResolvedValue({
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

      mockPrisma.account.findFirst.mockResolvedValue(mockAccount);
      mockPrisma.journalLine.aggregate.mockResolvedValue({
        _sum: { debit: 0, credit: 0 },
      });
      mockPrisma.journalLine.findMany.mockResolvedValue(
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
      mockPrisma.account.findFirst.mockResolvedValue(null);

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

      mockPrisma.account.findFirst.mockResolvedValue(mockAccount);
      mockPrisma.journalLine.aggregate.mockResolvedValue({
        _sum: { debit: 5000, credit: 2000 },
      });
      mockPrisma.journalLine.findMany.mockResolvedValue([]);

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
      mockPrisma.journalLine.aggregate
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
      mockPrisma.journalLine.aggregate.mockResolvedValue({
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
