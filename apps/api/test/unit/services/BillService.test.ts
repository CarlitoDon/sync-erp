import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  mockInvoiceRepository,
  resetRepositoryMocks,
} from '../mocks/repositories.mock';

// Mock JournalService with function() syntax for Vitest 4.x
const mockJournalService = {
  postBill: vi.fn().mockResolvedValue({}),
};
vi.mock(
  '../../../src/modules/accounting/services/journal.service',
  () => ({
    JournalService: function () {
      return mockJournalService;
    },
  })
);

// Mock DocumentNumberService with function() syntax for Vitest 4.x
const mockDocumentNumberService = {
  generate: vi.fn().mockResolvedValue('BILL-00001'),
};
vi.mock(
  '../../../src/modules/common/services/document-number.service',
  () => ({
    DocumentNumberService: function () {
      return mockDocumentNumberService;
    },
  })
);

// Mock BillPostingSaga
const mockBillPostingSaga = {
  execute: vi.fn(),
};
vi.mock(
  '../../../src/modules/accounting/sagas/bill-posting.saga',
  () => ({
    BillPostingSaga: function () {
      return mockBillPostingSaga;
    },
  })
);

// Mock the InvoiceRepository module (BillService uses InvoiceRepository)
vi.mock(
  '../../../src/modules/accounting/repositories/invoice.repository',
  () => ({
    InvoiceRepository: function () {
      return mockInvoiceRepository;
    },
  })
);

// Mock InventoryRepository for GRN check (BillService requires GRN before Bill)
const mockInventoryRepository = {
  countByReferencePatterns: vi.fn().mockResolvedValue(1), // GRN exists
};
vi.mock(
  '../../../src/modules/inventory/inventory.repository',
  () => ({
    InventoryRepository: function () {
      return mockInventoryRepository;
    },
  })
);

// Import after mocking
import { BillService } from '../../../src/modules/accounting/services/bill.service';

describe('BillService', () => {
  let service: BillService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetRepositoryMocks();
    vi.clearAllMocks();
    service = new BillService();
  });

  describe('createFromPurchaseOrder', () => {
    it('should create a bill from a purchase order', async () => {
      const mockOrder = {
        id: 'order-1',
        companyId,
        type: 'PURCHASE',
        status: 'CONFIRMED', // Policy requires CONFIRMED status
        totalAmount: 1000,
        taxRate: 10,
        partnerId: 'partner-1',
        items: [],
        partner: { id: 'partner-1', name: 'Supplier' },
      };

      const mockBill = {
        id: 'bill-1',
        companyId,
        orderId: 'order-1',
        type: 'BILL',
        status: 'DRAFT',
        amount: 1100,
        invoiceNumber: 'BILL-00001',
      };

      mockInvoiceRepository.findOrder.mockResolvedValue(mockOrder);
      mockInvoiceRepository.count.mockResolvedValue(0);
      mockInvoiceRepository.create.mockResolvedValue(mockBill);

      const result = await service.createFromPurchaseOrder(
        companyId,
        {
          orderId: 'order-1',
        }
      );

      expect(result).toEqual(mockBill);
    });

    it('should throw error if purchase order not found', async () => {
      mockInvoiceRepository.findOrder.mockResolvedValue(null);

      await expect(
        service.createFromPurchaseOrder(companyId, {
          orderId: 'nonexistent',
        })
      ).rejects.toThrow('Purchase order not found');
    });
  });

  describe('getById', () => {
    it('should return a bill by ID', async () => {
      const mockBill = { id: 'bill-1', companyId, type: 'BILL' };
      mockInvoiceRepository.findById.mockResolvedValue(mockBill);

      const result = await service.getById('bill-1', companyId);

      expect(result).toEqual(mockBill);
    });

    it('should return null for non-existent bill', async () => {
      mockInvoiceRepository.findById.mockResolvedValue(null);

      const result = await service.getById('nonexistent', companyId);

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all bills', async () => {
      const mockBills = [
        { id: 'bill-1', type: 'BILL' },
        { id: 'bill-2', type: 'BILL' },
      ];
      mockInvoiceRepository.findAll.mockResolvedValue(mockBills);

      const result = await service.list(companyId);

      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const mockBills = [{ id: 'bill-1', status: 'POSTED' }];
      mockInvoiceRepository.findAll.mockResolvedValue(mockBills);

      const result = await service.list(companyId, 'POSTED');

      expect(result).toHaveLength(1);
    });
  });

  describe('post', () => {
    it('should delegate to BillPostingSaga', async () => {
      const mockBill = {
        id: 'bill-1',
        companyId,
        status: 'DRAFT', // Must be draft for guard
      };

      // Mock findById for state guard
      mockInvoiceRepository.findById.mockResolvedValue(mockBill);

      mockBillPostingSaga.execute.mockResolvedValue({
        success: true,
        data: { ...mockBill, status: 'POSTED' },
      });

      const result = await service.post('bill-1', companyId);

      expect(result).toEqual({ ...mockBill, status: 'POSTED' });
      expect(mockBillPostingSaga.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          billId: 'bill-1',
          companyId,
        }),
        'bill-1',
        companyId,
        undefined // correlationId
      );
    });

    it('should throw error if saga fails', async () => {
      // Mock findById for state guard
      mockInvoiceRepository.findById.mockResolvedValue({
        id: 'bill-1',
        companyId,
        status: 'DRAFT',
      });

      mockBillPostingSaga.execute.mockResolvedValue({
        success: false,
        error: new Error('Saga failed'),
      });

      await expect(service.post('bill-1', companyId)).rejects.toThrow(
        'Saga failed'
      );
    });
  });

  describe('void', () => {
    it('should void a bill', async () => {
      const mockBill = { id: 'bill-1', companyId, status: 'DRAFT' };
      const voidedBill = { ...mockBill, status: 'VOID' };

      mockInvoiceRepository.findById.mockResolvedValue(mockBill);
      mockInvoiceRepository.update.mockResolvedValue(voidedBill);

      const result = await service.void('bill-1', companyId);

      expect(result.status).toBe('VOID');
    });

    it('should throw error if bill not found', async () => {
      mockInvoiceRepository.findById.mockResolvedValue(null);

      await expect(
        service.void('nonexistent', companyId)
      ).rejects.toThrow('Bill not found');
    });

    it('should throw error if bill is already paid', async () => {
      const mockBill = { id: 'bill-1', status: 'PAID' };
      mockInvoiceRepository.findById.mockResolvedValue(mockBill);

      await expect(service.void('bill-1', companyId)).rejects.toThrow(
        'Cannot void a paid bill'
      );
    });
  });

  describe('getOutstanding', () => {
    it('should return outstanding bills', async () => {
      const mockBills = [{ id: 'bill-1', status: 'POSTED' }];
      mockInvoiceRepository.findAll.mockResolvedValue(mockBills);

      const result = await service.getOutstanding(companyId);

      expect(result).toHaveLength(1);
    });
  });

  describe('getRemainingAmount', () => {
    it('should return the balance field', async () => {
      const mockBill = {
        id: 'bill-1',
        amount: 1000,
        balance: 500,
      };
      mockInvoiceRepository.findById.mockResolvedValue(mockBill);

      const result = await service.getRemainingAmount(
        'bill-1',
        companyId
      );

      expect(result).toBe(500);
    });

    it('should throw error if bill not found', async () => {
      mockInvoiceRepository.findById.mockResolvedValue(null);

      await expect(
        service.getRemainingAmount('nonexistent', companyId)
      ).rejects.toThrow('Bill not found');
    });
  });
});
