import { vi } from 'vitest';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

// Mock the database module

// Mock JournalService
vi.mock('../../../src/services/JournalService', () => ({
  JournalService: vi.fn().mockImplementation(() => ({
    postPaymentReceived: vi.fn().mockResolvedValue({}),
    postPaymentMade: vi.fn().mockResolvedValue({}),
  })),
}));

// Import after mocking
import { PaymentService } from '../../../src/services/PaymentService';

describe('PaymentService', () => {
  let service: PaymentService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetMocks();
    service = new PaymentService();
  });

  describe('create', () => {
    it('should create a payment for a posted invoice', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        companyId,
        status: 'POSTED',
        type: 'INVOICE',
        amount: 1000,
        invoiceNumber: 'INV-001',
        payments: [],
      };

      const mockPayment = {
        id: 'payment-1',
        companyId,
        invoiceId: 'invoice-1',
        amount: 500,
        method: 'TRANSFER',
      };

      mockPrisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      mockPrisma.payment.create.mockResolvedValue(mockPayment);
      mockPrisma.invoice.update.mockResolvedValue({ ...mockInvoice, balance: 500 });

      const result = await service.create(companyId, {
        invoiceId: 'invoice-1',
        amount: 500,
        method: 'TRANSFER',
      });

      expect(result).toEqual(mockPayment);
    });

    it('should throw error for non-existent invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.create(companyId, { invoiceId: 'nonexistent', amount: 100, method: 'CASH' })
      ).rejects.toThrow('Invoice not found');
    });

    it('should throw error for voided invoice', async () => {
      const mockInvoice = { id: 'invoice-1', status: 'VOID', payments: [] };
      mockPrisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      await expect(
        service.create(companyId, { invoiceId: 'invoice-1', amount: 100, method: 'CASH' })
      ).rejects.toThrow('Cannot pay a voided invoice');
    });

    it('should throw error for draft invoice', async () => {
      const mockInvoice = { id: 'invoice-1', status: 'DRAFT', payments: [] };
      mockPrisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      await expect(
        service.create(companyId, { invoiceId: 'invoice-1', amount: 100, method: 'CASH' })
      ).rejects.toThrow('Invoice must be posted before payment');
    });

    it('should throw error if payment exceeds remaining balance', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        status: 'POSTED',
        amount: 1000,
        payments: [{ amount: 800 }],
      };
      mockPrisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      await expect(
        service.create(companyId, { invoiceId: 'invoice-1', amount: 500, method: 'CASH' })
      ).rejects.toThrow('Payment amount (500) exceeds remaining balance (200)');
    });
  });

  describe('getById', () => {
    it('should return payment by ID', async () => {
      const mockPayment = { id: 'payment-1', companyId, amount: 500 };
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);

      const result = await service.getById('payment-1', companyId);

      expect(result).toEqual(mockPayment);
    });

    it('should return null for non-existent payment', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      const result = await service.getById('nonexistent', companyId);

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all payments for a company', async () => {
      const mockPayments = [
        { id: 'payment-1', amount: 500 },
        { id: 'payment-2', amount: 300 },
      ];
      mockPrisma.payment.findMany.mockResolvedValue(mockPayments);

      const result = await service.list(companyId);

      expect(result).toHaveLength(2);
    });

    it('should filter by invoiceId', async () => {
      const mockPayments = [{ id: 'payment-1', invoiceId: 'invoice-1' }];
      mockPrisma.payment.findMany.mockResolvedValue(mockPayments);

      const result = await service.list(companyId, 'invoice-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getPaymentHistory', () => {
    it('should return payment history for an invoice', async () => {
      const mockPayments = [
        { id: 'payment-1', invoiceId: 'invoice-1', amount: 200 },
        { id: 'payment-2', invoiceId: 'invoice-1', amount: 300 },
      ];
      mockPrisma.payment.findMany.mockResolvedValue(mockPayments);

      const result = await service.getPaymentHistory('invoice-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('getTotalReceived', () => {
    it('should calculate total received for an invoice', async () => {
      const mockPayments = [{ amount: 200 }, { amount: 300 }, { amount: 150 }];
      mockPrisma.payment.findMany.mockResolvedValue(mockPayments);

      const result = await service.getTotalReceived('invoice-1');

      expect(result).toBe(650);
    });

    it('should return 0 for invoice with no payments', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const result = await service.getTotalReceived('invoice-1');

      expect(result).toBe(0);
    });
  });
});
