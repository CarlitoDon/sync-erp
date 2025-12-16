import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService } from '../../../../src/modules/accounting/services/payment.service';
import { InvoiceType, InvoiceStatus } from '@sync-erp/database';

// Automock deps
vi.mock(
  '../../../../src/modules/accounting/repositories/payment.repository'
);
vi.mock(
  '../../../../src/modules/accounting/repositories/invoice.repository'
);
vi.mock(
  '../../../../src/modules/accounting/services/journal.service'
);

describe('T009: Implement/Verify Payment Service (SC-001)', () => {
  let service: PaymentService;
  let mockPaymentRepo: any;
  let mockInvoiceRepo: any;
  let mockJournalService: any;

  const companyId = 'co-1';
  const invoiceId = 'inv-1';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentService();
    mockPaymentRepo = (service as any).repository;
    mockInvoiceRepo = (service as any).invoiceRepository;
    mockJournalService = (service as any).journalService;
  });

  describe('create', () => {
    it('should create partial payment and update balance (Invoice)', async () => {
      const mockInvoice = {
        id: invoiceId,
        status: InvoiceStatus.POSTED,
        type: InvoiceType.INVOICE,
        invoiceNumber: 'INV-001',
        amount: 100,
        balance: 100,
      };

      mockInvoiceRepo.findById.mockResolvedValue(mockInvoice);
      mockPaymentRepo.create.mockResolvedValue({
        id: 'pay-1',
        amount: 40,
      });

      const input = {
        invoiceId,
        amount: 40,
        method: 'BANK_TRANSFER',
      };
      await service.create(companyId, input);

      // Verify Payment Created
      expect(mockPaymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 40,
          method: 'BANK_TRANSFER',
        })
      );

      // Verify Invoice Update (Balance 60, Status still POSTED)
      expect(mockInvoiceRepo.update).toHaveBeenCalledWith(invoiceId, {
        status: InvoiceStatus.POSTED,
        balance: 60,
      });

      // Verify Journal
      expect(
        mockJournalService.postPaymentReceived
      ).toHaveBeenCalledWith(
        companyId,
        'INV-001',
        40,
        'BANK_TRANSFER'
      );
    });

    it('should create full payment and mark PAID (Bill)', async () => {
      const mockBill = {
        id: 'bill-1',
        status: InvoiceStatus.POSTED,
        type: InvoiceType.BILL,
        invoiceNumber: 'BILL-001',
        amount: 100,
        balance: 100,
      };

      mockInvoiceRepo.findById.mockResolvedValue(mockBill);
      mockPaymentRepo.create.mockResolvedValue({
        id: 'pay-2',
        amount: 100,
      });

      const input = {
        invoiceId: 'bill-1',
        amount: 100,
        method: 'CASH',
      };
      await service.create(companyId, input);

      // Verify Invoice Update (Balance 0, Status PAID)
      expect(mockInvoiceRepo.update).toHaveBeenCalledWith('bill-1', {
        status: InvoiceStatus.PAID,
        balance: 0,
      });

      // Verify Journal for Bill
      expect(mockJournalService.postPaymentMade).toHaveBeenCalled();
    });

    it('should fail if overpaying', async () => {
      const mockInvoice = {
        id: invoiceId,
        status: InvoiceStatus.POSTED,
        balance: 50,
      };
      mockInvoiceRepo.findById.mockResolvedValue(mockInvoice);

      await expect(
        service.create(companyId, {
          invoiceId,
          amount: 60,
          method: 'CASH',
        })
      ).rejects.toThrow(/exceeds remaining balance/);
    });

    it('should fail if invoice is DRAFT', async () => {
      const mockInvoice = {
        id: invoiceId,
        status: InvoiceStatus.DRAFT,
      };
      mockInvoiceRepo.findById.mockResolvedValue(mockInvoice);

      await expect(
        service.create(companyId, {
          invoiceId,
          amount: 10,
          method: 'CASH',
        })
      ).rejects.toThrow(/must be posted/);
    });
  });
});
