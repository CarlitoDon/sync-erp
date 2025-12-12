import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  mockPaymentRepository,
  mockInvoiceRepository,
  resetRepositoryMocks,
} from '../mocks/repositories.mock';

// Mock JournalService
const mockJournalService = {
  postPaymentReceived: vi.fn().mockResolvedValue({}),
  postPaymentMade: vi.fn().mockResolvedValue({}),
};
vi.mock(
  '../../../src/modules/accounting/services/journal.service',
  () => ({
    JournalService: vi
      .fn()
      .mockImplementation(() => mockJournalService),
  })
);

// Mock PaymentRepository
vi.mock(
  '../../../src/modules/accounting/repositories/payment.repository',
  () => ({
    PaymentRepository: vi
      .fn()
      .mockImplementation(() => mockPaymentRepository),
  })
);

// Mock InvoiceRepository
vi.mock(
  '../../../src/modules/accounting/repositories/invoice.repository',
  () => ({
    InvoiceRepository: vi
      .fn()
      .mockImplementation(() => mockInvoiceRepository),
  })
);

// Import after mocking
import { PaymentService } from '../../../src/modules/accounting/services/payment.service';

describe('PaymentService', () => {
  let service: PaymentService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetRepositoryMocks();
    vi.clearAllMocks();
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
        balance: 1000,
        invoiceNumber: 'INV-001',
      };

      const mockPayment = {
        id: 'payment-1',
        companyId,
        invoiceId: 'invoice-1',
        amount: 500,
        method: 'TRANSFER',
      };

      mockInvoiceRepository.findById.mockResolvedValue(mockInvoice);
      mockPaymentRepository.create.mockResolvedValue(mockPayment);
      mockInvoiceRepository.update.mockResolvedValue({
        ...mockInvoice,
        balance: 500,
      });

      const result = await service.create(companyId, {
        invoiceId: 'invoice-1',
        amount: 500,
        method: 'TRANSFER',
      });

      expect(result).toEqual(mockPayment);
    });

    it('should throw error for non-existent invoice', async () => {
      mockInvoiceRepository.findById.mockResolvedValue(null);

      await expect(
        service.create(companyId, {
          invoiceId: 'nonexistent',
          amount: 100,
          method: 'CASH',
        })
      ).rejects.toThrow('Invoice not found');
    });

    it('should throw error for voided invoice', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        status: 'VOID',
        balance: 1000,
      };
      mockInvoiceRepository.findById.mockResolvedValue(mockInvoice);

      await expect(
        service.create(companyId, {
          invoiceId: 'invoice-1',
          amount: 100,
          method: 'CASH',
        })
      ).rejects.toThrow('Cannot pay a voided invoice');
    });

    it('should throw error for draft invoice', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        status: 'DRAFT',
        balance: 1000,
      };
      mockInvoiceRepository.findById.mockResolvedValue(mockInvoice);

      await expect(
        service.create(companyId, {
          invoiceId: 'invoice-1',
          amount: 100,
          method: 'CASH',
        })
      ).rejects.toThrow('Invoice must be posted before payment');
    });

    it('should throw error if payment exceeds remaining balance', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        status: 'POSTED',
        amount: 1000,
        balance: 200,
      };
      mockInvoiceRepository.findById.mockResolvedValue(mockInvoice);

      await expect(
        service.create(companyId, {
          invoiceId: 'invoice-1',
          amount: 500,
          method: 'CASH',
        })
      ).rejects.toThrow(
        'Payment amount (500) exceeds remaining balance (200)'
      );
    });
  });

  describe('getById', () => {
    it('should return payment by ID', async () => {
      const mockPayment = { id: 'payment-1', companyId, amount: 500 };
      mockPaymentRepository.findById.mockResolvedValue(mockPayment);

      const result = await service.getById('payment-1', companyId);

      expect(result).toEqual(mockPayment);
    });

    it('should return null for non-existent payment', async () => {
      mockPaymentRepository.findById.mockResolvedValue(null);

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
      mockPaymentRepository.findAll.mockResolvedValue(mockPayments);

      const result = await service.list(companyId);

      expect(result).toHaveLength(2);
    });

    it('should filter by invoiceId', async () => {
      const mockPayments = [
        { id: 'payment-1', invoiceId: 'invoice-1' },
      ];
      mockPaymentRepository.findAll.mockResolvedValue(mockPayments);

      const result = await service.list(companyId, 'invoice-1');

      expect(result).toHaveLength(1);
    });
  });
});
