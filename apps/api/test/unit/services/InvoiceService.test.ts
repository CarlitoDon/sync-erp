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
    postInvoice: vi.fn().mockResolvedValue({}),
  })),
}));

// Import after mocking
import { InvoiceService } from '../../../src/services/InvoiceService';

describe('InvoiceService', () => {
  let service: InvoiceService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
    service = new InvoiceService();
  });

  describe('createFromSalesOrder', () => {
    it('should create an invoice from a sales order', async () => {
      const mockOrder = {
        id: 'order-1',
        companyId,
        type: 'SALES',
        totalAmount: 1000,
        taxRate: 11,
        partnerId: 'partner-1',
        items: [],
        partner: { id: 'partner-1', name: 'Customer' },
      };

      const mockInvoice = {
        id: 'inv-1',
        companyId,
        orderId: 'order-1',
        type: 'INVOICE',
        status: 'DRAFT',
        amount: 1110,
        invoiceNumber: 'INV-00001',
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);

      const result = await service.createFromSalesOrder(companyId, 'user-1', {
        orderId: 'order-1',
      });

      expect(result).toEqual(mockInvoice);
    });

    it('should throw error if sales order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.createFromSalesOrder(companyId, 'user-1', { orderId: 'nonexistent' })
      ).rejects.toThrow('Sales order not found');
    });
  });

  describe('getById', () => {
    it('should return an invoice by ID', async () => {
      const mockInvoice = { id: 'inv-1', companyId, type: 'INVOICE' };
      mockPrisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      const result = await service.getById('inv-1', companyId);

      expect(result).toEqual(mockInvoice);
    });

    it('should return null for non-existent invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      const result = await service.getById('nonexistent', companyId);

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all invoices', async () => {
      const mockInvoices = [
        { id: 'inv-1', type: 'INVOICE' },
        { id: 'inv-2', type: 'INVOICE' },
      ];
      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);

      const result = await service.list(companyId);

      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const mockInvoices = [{ id: 'inv-1', status: 'POSTED' }];
      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);

      const result = await service.list(companyId, 'POSTED');

      expect(result).toHaveLength(1);
    });
  });

  describe('post', () => {
    it('should post a draft invoice', async () => {
      const mockInvoice = {
        id: 'inv-1',
        companyId,
        status: 'DRAFT',
        invoiceNumber: 'INV-001',
        amount: 1000,
        subtotal: 909,
        taxAmount: 91,
      };
      const postedInvoice = { ...mockInvoice, status: 'POSTED' };

      mockPrisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      mockPrisma.invoice.update.mockResolvedValue(postedInvoice);

      const result = await service.post('inv-1', companyId);

      expect(result.status).toBe('POSTED');
    });

    it('should throw error if invoice not found', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      await expect(service.post('nonexistent', companyId)).rejects.toThrow('Invoice not found');
    });

    it('should throw error if invoice is not in draft status', async () => {
      const mockInvoice = { id: 'inv-1', status: 'POSTED' };
      mockPrisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      await expect(service.post('inv-1', companyId)).rejects.toThrow(
        'Cannot post invoice with status: POSTED'
      );
    });
  });

  describe('void', () => {
    it('should void an invoice', async () => {
      const mockInvoice = { id: 'inv-1', companyId, status: 'DRAFT' };
      const voidedInvoice = { ...mockInvoice, status: 'VOID' };

      mockPrisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      mockPrisma.invoice.update.mockResolvedValue(voidedInvoice);

      const result = await service.void('inv-1', companyId);

      expect(result.status).toBe('VOID');
    });

    it('should throw error if invoice not found', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      await expect(service.void('nonexistent', companyId)).rejects.toThrow('Invoice not found');
    });

    it('should throw error if invoice is already paid', async () => {
      const mockInvoice = { id: 'inv-1', status: 'PAID' };
      mockPrisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      await expect(service.void('inv-1', companyId)).rejects.toThrow('Cannot void a paid invoice');
    });
  });

  describe('getOutstanding', () => {
    it('should return outstanding invoices', async () => {
      const mockInvoices = [{ id: 'inv-1', status: 'POSTED' }];
      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);

      const result = await service.getOutstanding(companyId);

      expect(result).toHaveLength(1);
    });
  });

  describe('getRemainingAmount', () => {
    it('should calculate remaining amount', async () => {
      const mockInvoice = {
        id: 'inv-1',
        amount: 1000,
        payments: [{ amount: 300 }, { amount: 200 }],
      };
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await service.getRemainingAmount('inv-1');

      expect(result).toBe(500);
    });

    it('should throw error if invoice not found', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(service.getRemainingAmount('nonexistent')).rejects.toThrow('Invoice not found');
    });
  });
});
