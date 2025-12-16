import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  mockJournalRepository,
  mockAccountRepository,
  resetRepositoryMocks,
} from '../mocks/repositories.mock';

// Mock AccountService
const mockAccountService = {
  getById: vi.fn(),
  getByCode: vi.fn(),
};
vi.mock(
  '../../../src/modules/accounting/services/account.service',
  () => ({
    AccountService: function () {
      return mockAccountService;
    },
  })
);

// Mock the JournalRepository module
vi.mock(
  '../../../src/modules/accounting/repositories/journal.repository',
  () => ({
    JournalRepository: function () {
      return mockJournalRepository;
    },
  })
);

// Import after mocking
import { JournalService } from '../../../src/modules/accounting/services/journal.service';

describe('JournalService', () => {
  let service: JournalService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetRepositoryMocks();
    vi.clearAllMocks();
    service = new JournalService();

    // Setup default account mocks
    mockAccountService.getById.mockResolvedValue({
      id: 'acc-1',
      code: '1100',
      name: 'Cash',
    });
    mockAccountService.getByCode.mockImplementation((_, code) =>
      Promise.resolve({
        id: `acc-${code}`,
        code,
        name: `Account ${code}`,
      })
    );
  });

  describe('create', () => {
    it('should create a balanced journal entry', async () => {
      const mockJournal = {
        id: 'je-1',
        companyId,
        reference: 'JE-001',
        lines: [],
      };

      mockJournalRepository.create.mockResolvedValue(mockJournal);

      const result = await service.create(companyId, {
        reference: 'JE-001',
        memo: 'Test entry',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 },
        ],
      });

      expect(result).toEqual(mockJournal);
    });

    it('should throw error if journal is unbalanced', async () => {
      await expect(
        service.create(companyId, {
          reference: 'JE-001',
          lines: [
            { accountId: 'acc-1', debit: 100, credit: 0 },
            { accountId: 'acc-2', debit: 0, credit: 50 },
          ],
        })
      ).rejects.toThrow('Journal entry is unbalanced');
    });

    it('should throw error if account not found', async () => {
      mockAccountService.getById.mockResolvedValue(null);

      await expect(
        service.create(companyId, {
          lines: [
            { accountId: 'nonexistent', debit: 100, credit: 0 },
            { accountId: 'acc-2', debit: 0, credit: 100 },
          ],
        })
      ).rejects.toThrow('Account not found');
    });
  });

  describe('getById', () => {
    it('should return a journal entry by ID', async () => {
      const mockJournal = { id: 'je-1', companyId };
      mockJournalRepository.findById.mockResolvedValue(mockJournal);

      const result = await service.getById('je-1', companyId);

      expect(result).toEqual(mockJournal);
    });

    it('should return null for non-existent journal entry', async () => {
      mockJournalRepository.findById.mockResolvedValue(null);

      const result = await service.getById('nonexistent', companyId);

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list journal entries', async () => {
      const mockJournals = [
        { id: 'je-1', date: new Date() },
        { id: 'je-2', date: new Date() },
      ];
      mockJournalRepository.findAll.mockResolvedValue(mockJournals);

      const result = await service.list(companyId);

      expect(result).toHaveLength(2);
    });

    it('should filter by date range', async () => {
      const mockJournals = [{ id: 'je-1' }];
      mockJournalRepository.findAll.mockResolvedValue(mockJournals);

      const result = await service.list(
        companyId,
        new Date('2025-01-01'),
        new Date('2025-12-31')
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('postInvoice', () => {
    it('should post invoice journal entry', async () => {
      const mockJournal = {
        id: 'je-1',
        reference: 'Invoice: INV-001',
      };
      mockJournalRepository.create.mockResolvedValue(mockJournal);

      const result = await service.postInvoice(
        companyId,
        'INV-001',
        1100,
        1000,
        100
      );

      expect(result.reference).toContain('INV-001');
    });

    it('should post invoice without tax', async () => {
      const mockJournal = {
        id: 'je-1',
        reference: 'Invoice: INV-002',
      };
      mockJournalRepository.create.mockResolvedValue(mockJournal);

      const result = await service.postInvoice(
        companyId,
        'INV-002',
        1000
      );

      expect(result).toEqual(mockJournal);
    });
  });

  describe('postBill', () => {
    it('should post bill journal entry', async () => {
      const mockJournal = { id: 'je-1', reference: 'Bill: BILL-001' };
      mockJournalRepository.create.mockResolvedValue(mockJournal);

      const result = await service.postBill(
        companyId,
        'BILL-001',
        1100,
        1000,
        100
      );

      expect(result.reference).toContain('BILL-001');
    });

    it('should post bill without tax', async () => {
      const mockJournal = { id: 'je-1', reference: 'Bill: BILL-002' };
      mockJournalRepository.create.mockResolvedValue(mockJournal);

      const result = await service.postBill(
        companyId,
        'BILL-002',
        1000
      );

      expect(result).toEqual(mockJournal);
    });
  });

  describe('postGoodsReceipt', () => {
    it('should post goods receipt accrual journal', async () => {
      const mockJournal = { id: 'je-1', reference: 'GR-001' };
      mockJournalRepository.create.mockResolvedValue(mockJournal);

      const result = await service.postGoodsReceipt(
        companyId,
        'GR-001',
        5000
      );

      expect(result).toEqual(mockJournal);
    });
  });

  describe('postPaymentReceived', () => {
    it('should post payment received journal (cash)', async () => {
      const mockJournal = { id: 'je-1' };
      mockJournalRepository.create.mockResolvedValue(mockJournal);

      const result = await service.postPaymentReceived(
        companyId,
        'INV-001',
        500,
        'CASH'
      );

      expect(result).toEqual(mockJournal);
    });

    it('should post payment received journal (bank transfer)', async () => {
      const mockJournal = { id: 'je-1' };
      mockJournalRepository.create.mockResolvedValue(mockJournal);

      const result = await service.postPaymentReceived(
        companyId,
        'INV-001',
        500,
        'BANK_TRANSFER'
      );

      expect(result).toEqual(mockJournal);
    });
  });

  describe('postPaymentMade', () => {
    it('should post payment made journal (cash)', async () => {
      const mockJournal = { id: 'je-1' };
      mockJournalRepository.create.mockResolvedValue(mockJournal);

      const result = await service.postPaymentMade(
        companyId,
        'BILL-001',
        500,
        'CASH'
      );

      expect(result).toEqual(mockJournal);
    });

    it('should post payment made journal (bank transfer)', async () => {
      const mockJournal = { id: 'je-1' };
      mockJournalRepository.create.mockResolvedValue(mockJournal);

      const result = await service.postPaymentMade(
        companyId,
        'BILL-001',
        500,
        'BANK_TRANSFER'
      );

      expect(result).toEqual(mockJournal);
    });
  });

  describe('postShipment', () => {
    it('should post shipment COGS journal', async () => {
      const mockJournal = { id: 'je-1', memo: 'COGS' };
      mockJournalRepository.create.mockResolvedValue(mockJournal);

      const result = await service.postShipment(
        companyId,
        'SHIP-001',
        1000
      );

      expect(result).toEqual(mockJournal);
    });
  });

  describe('postSalesReturn', () => {
    it('should post sales return reversal journal', async () => {
      const mockJournal = { id: 'je-1', memo: 'reversal' };
      mockJournalRepository.create.mockResolvedValue(mockJournal);

      const result = await service.postSalesReturn(
        companyId,
        'RET-001',
        200
      );

      expect(result).toEqual(mockJournal);
    });
  });

  describe('postAdjustment', () => {
    it('should post stock loss adjustment', async () => {
      const mockJournal = { id: 'je-1' };
      mockJournalRepository.create.mockResolvedValue(mockJournal);

      const result = await service.postAdjustment(
        companyId,
        'ADJ-001',
        100,
        true
      );

      expect(result).toEqual(mockJournal);
    });

    it('should post stock gain adjustment', async () => {
      const mockJournal = { id: 'je-1' };
      mockJournalRepository.create.mockResolvedValue(mockJournal);

      const result = await service.postAdjustment(
        companyId,
        'ADJ-002',
        50,
        false
      );

      expect(result).toEqual(mockJournal);
    });
  });

  describe('resolveAndCreate (private method - tested via public methods)', () => {
    it('should throw error if system account not found', async () => {
      mockAccountService.getByCode.mockResolvedValue(null);

      await expect(
        service.postInvoice(companyId, 'INV-001', 1000)
      ).rejects.toThrow('System Account code');
    });
  });
});
