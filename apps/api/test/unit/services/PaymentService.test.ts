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
    JournalService: function () {
      return mockJournalService;
    },
  })
);

// Mock PaymentRepository
vi.mock(
  '../../../src/modules/accounting/repositories/payment.repository',
  () => ({
    PaymentRepository: function () {
      return mockPaymentRepository;
    },
  })
);

// Mock PaymentPostingSaga
const mockPaymentPostingSaga = {
  execute: vi.fn(),
};
vi.mock(
  '../../../src/modules/accounting/sagas/payment-posting.saga',
  () => ({
    PaymentPostingSaga: function () {
      return mockPaymentPostingSaga;
    },
  })
);

// Mock InvoiceRepository
vi.mock(
  '../../../src/modules/accounting/repositories/invoice.repository',
  () => ({
    InvoiceRepository: function () {
      return mockInvoiceRepository;
    },
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
    it('should delegate to PaymentPostingSaga', async () => {
      const mockPayment = {
        id: 'payment-1',
        companyId,
        invoiceId: 'invoice-1',
        amount: 500,
        method: 'BANK_TRANSFER',
      };

      mockPaymentPostingSaga.execute.mockResolvedValue({
        success: true,
        data: mockPayment,
      });

      const result = await service.create(companyId, {
        invoiceId: 'invoice-1',
        amount: 500,
        method: 'BANK_TRANSFER',
      });

      expect(result).toEqual(mockPayment);
      expect(mockPaymentPostingSaga.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: 'invoice-1',
          amount: 500,
          companyId,
        }),
        'invoice-1',
        companyId
      );
    });

    it('should throw error if saga fails', async () => {
      mockPaymentPostingSaga.execute.mockResolvedValue({
        success: false,
        error: new Error('Saga failed'),
      });

      await expect(
        service.create(companyId, {
          invoiceId: 'invoice-1',
          amount: 500,
          method: 'CASH',
        })
      ).rejects.toThrow('Saga failed');
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
