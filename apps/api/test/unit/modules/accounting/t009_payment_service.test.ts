import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService } from '@modules/accounting/services/payment.service';
// import { InvoiceType, InvoiceStatus } from '@sync-erp/database';

// Automock deps
vi.mock('@modules/accounting/repositories/payment.repository');
vi.mock('@modules/accounting/repositories/invoice.repository');
vi.mock('@modules/accounting/services/journal.service');

// Mock Saga
const mockPaymentPostingSaga = { execute: vi.fn() };
vi.mock('@modules/accounting/sagas/payment-posting.saga', () => ({
  PaymentPostingSaga: function () {
    return mockPaymentPostingSaga;
  },
}));

describe('T009: Implement/Verify Payment Service (SC-001)', () => {
  let service: PaymentService;

  const companyId = 'co-1';
  const invoiceId = 'inv-1';

  beforeEach(() => {
    vi.clearAllMocks();
    mockPaymentPostingSaga.execute.mockClear();
    service = new PaymentService();
    // mockPaymentRepo = (service as any).repository;
    // mockInvoiceRepo = (service as any).invoiceRepository;
    // mockJournalService = (service as any).journalService;
  });

  describe('create', () => {
    it('should create payment via Saga', async () => {
      const paymentId = 'pay-1';
      const mockPayment = {
        id: paymentId,
        amount: 40,
        method: 'BANK_TRANSFER',
      };

      const input = {
        invoiceId,
        amount: 40,
        method: 'BANK_TRANSFER' as const,
      };

      // Saga Success
      mockPaymentPostingSaga.execute.mockResolvedValue({
        success: true,
        data: mockPayment,
      });

      const result = await service.create(companyId, input);

      // Verify Saga Called
      expect(mockPaymentPostingSaga.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId,
          amount: 40,
          companyId,
        }),
        invoiceId,
        companyId
      );

      expect(result).toEqual(mockPayment);
    });

    it('should fail if Saga fails (e.g. overpayment)', async () => {
      mockPaymentPostingSaga.execute.mockResolvedValue({
        success: false,
        error: new Error('Payment amount exceeds remaining balance'),
      });

      await expect(
        service.create(companyId, {
          invoiceId,
          amount: 60,
          method: 'CASH',
        })
      ).rejects.toThrow(/exceeds remaining balance/);
    });
  });
});
