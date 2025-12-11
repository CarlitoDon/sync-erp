import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

// Mock the database module
vi.mock('@sync-erp/database', () => ({
  prisma: mockPrisma,
  InvoiceType: {
    INVOICE: 'INVOICE',
    BILL: 'BILL',
  },
  InvoiceStatus: {
    DRAFT: 'DRAFT',
    POSTED: 'POSTED',
    PAID: 'PAID',
    VOID: 'VOID',
  },
  OrderType: {
    PURCHASE: 'PURCHASE',
    SALES: 'SALES',
  },
}));

// Mock JournalService
vi.mock('../../../src/services/JournalService', () => ({
  JournalService: vi.fn().mockImplementation(() => ({
    postBill: vi.fn().mockResolvedValue({}),
  })),
}));

// Import after mocking
import { BillService } from '../../../src/services/BillService';

describe('BillService', () => {
  let service: BillService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetMocks();
    service = new BillService();
  });

  describe('createFromPurchaseOrder', () => {
    it('should create a bill from a purchase order', async () => {
      const mockOrder = {
        id: 'order-1',
        companyId,
        type: 'PURCHASE',
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

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.invoice.create.mockResolvedValue(mockBill);

      const result = await service.createFromPurchaseOrder(companyId, 'user-1', {
        orderId: 'order-1',
      });

      expect(result).toEqual(mockBill);
    });

    it('should throw error if purchase order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.createFromPurchaseOrder(companyId, 'user-1', { orderId: 'nonexistent' })
      ).rejects.toThrow('Purchase order not found');
    });
  });

  describe('getById', () => {
    it('should return a bill by ID', async () => {
      const mockBill = { id: 'bill-1', companyId, type: 'BILL' };
      mockPrisma.invoice.findFirst.mockResolvedValue(mockBill);

      const result = await service.getById('bill-1', companyId);

      expect(result).toEqual(mockBill);
    });

    it('should return null for non-existent bill', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

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
      mockPrisma.invoice.findMany.mockResolvedValue(mockBills);

      const result = await service.list(companyId);

      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const mockBills = [{ id: 'bill-1', status: 'POSTED' }];
      mockPrisma.invoice.findMany.mockResolvedValue(mockBills);

      const result = await service.list(companyId, 'POSTED');

      expect(result).toHaveLength(1);
    });
  });

  describe('post', () => {
    it('should post a draft bill', async () => {
      const mockBill = {
        id: 'bill-1',
        companyId,
        status: 'DRAFT',
        invoiceNumber: 'BILL-001',
        amount: 1000,
        subtotal: 909,
        taxAmount: 91,
      };
      const postedBill = { ...mockBill, status: 'POSTED' };

      mockPrisma.invoice.findFirst.mockResolvedValue(mockBill);
      mockPrisma.invoice.update.mockResolvedValue(postedBill);

      const result = await service.post('bill-1', companyId);

      expect(result.status).toBe('POSTED');
    });

    it('should throw error if bill not found', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      await expect(service.post('nonexistent', companyId)).rejects.toThrow('Bill not found');
    });

    it('should throw error if bill is not in draft status', async () => {
      const mockBill = { id: 'bill-1', status: 'POSTED' };
      mockPrisma.invoice.findFirst.mockResolvedValue(mockBill);

      await expect(service.post('bill-1', companyId)).rejects.toThrow(
        'Cannot post bill with status: POSTED'
      );
    });
  });

  describe('void', () => {
    it('should void a bill', async () => {
      const mockBill = { id: 'bill-1', companyId, status: 'DRAFT' };
      const voidedBill = { ...mockBill, status: 'VOID' };

      mockPrisma.invoice.findFirst.mockResolvedValue(mockBill);
      mockPrisma.invoice.update.mockResolvedValue(voidedBill);

      const result = await service.void('bill-1', companyId);

      expect(result.status).toBe('VOID');
    });

    it('should throw error if bill not found', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      await expect(service.void('nonexistent', companyId)).rejects.toThrow('Bill not found');
    });

    it('should throw error if bill is already paid', async () => {
      const mockBill = { id: 'bill-1', status: 'PAID' };
      mockPrisma.invoice.findFirst.mockResolvedValue(mockBill);

      await expect(service.void('bill-1', companyId)).rejects.toThrow('Cannot void a paid bill');
    });
  });

  describe('getOutstanding', () => {
    it('should return outstanding bills', async () => {
      const mockBills = [{ id: 'bill-1', status: 'POSTED' }];
      mockPrisma.invoice.findMany.mockResolvedValue(mockBills);

      const result = await service.getOutstanding(companyId);

      expect(result).toHaveLength(1);
    });
  });

  describe('getRemainingAmount', () => {
    it('should calculate remaining amount', async () => {
      const mockBill = {
        id: 'bill-1',
        amount: 1000,
        payments: [{ amount: 300 }, { amount: 200 }],
      };
      mockPrisma.invoice.findUnique.mockResolvedValue(mockBill);

      const result = await service.getRemainingAmount('bill-1');

      expect(result).toBe(500);
    });

    it('should throw error if bill not found', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(service.getRemainingAmount('nonexistent')).rejects.toThrow('Bill not found');
    });
  });
});
