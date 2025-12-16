import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService } from '../../../../src/modules/accounting/services/payment.service';
import { InvoiceStatus, InvoiceType } from '@sync-erp/database';

// Mock dependencies
vi.mock(
  '../../../../src/modules/accounting/repositories/payment.repository'
);
vi.mock(
  '../../../../src/modules/accounting/repositories/invoice.repository'
);
vi.mock(
  '../../../../src/modules/accounting/services/journal.service'
);
vi.mock(
  '../../../../src/modules/common/services/idempotency.service'
);

describe('T020: Payment Concurrency Guard', () => {
  let service: PaymentService;
  let mockInvoiceRepo: any;
  let mockPaymentRepo: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentService();
    mockInvoiceRepo = (service as any).invoiceRepository;
    mockPaymentRepo = (service as any).repository;
  });

  const companyId = 'co-1';
  const invoiceId = 'inv-1';

  it('should process payment atomically', async () => {
    // Setup Invoice
    mockInvoiceRepo.findById.mockResolvedValue({
      id: invoiceId,
      status: InvoiceStatus.POSTED,
      balance: 100,
      type: InvoiceType.INVOICE,
      invoiceNumber: 'INV-1',
    });

    // Mock Atomic Update Success
    mockInvoiceRepo.decreaseBalanceWithGuard.mockResolvedValue({
      id: invoiceId,
      balance: 50, // Decremented successfully
    });

    // Mock Payment Create
    mockPaymentRepo.create.mockResolvedValue({ id: 'pay-1' });

    await service.create(companyId, {
      invoiceId,
      amount: 50,
      method: 'CASH',
    });

    // Verify Guard Called
    expect(
      mockInvoiceRepo.decreaseBalanceWithGuard
    ).toHaveBeenCalledWith(invoiceId, 50);
    // Status update NOT called because balance > 0
    expect(mockInvoiceRepo.update).not.toHaveBeenCalled();
  });

  it('should update status to PAID if balance zero', async () => {
    mockInvoiceRepo.findById.mockResolvedValue({
      id: invoiceId,
      status: InvoiceStatus.POSTED,
      balance: 50,
      type: InvoiceType.INVOICE,
      invoiceNumber: 'INV-1',
    });
    mockInvoiceRepo.decreaseBalanceWithGuard.mockResolvedValue({
      id: invoiceId,
      balance: 0,
    });
    mockPaymentRepo.create.mockResolvedValue({ id: 'pay-1' });

    await service.create(companyId, {
      invoiceId,
      amount: 50,
      method: 'CASH',
    });

    expect(
      mockInvoiceRepo.decreaseBalanceWithGuard
    ).toHaveBeenCalledWith(invoiceId, 50);
    expect(mockInvoiceRepo.update).toHaveBeenCalledWith(invoiceId, {
      status: InvoiceStatus.PAID,
    });
  });

  it('should fail if guard rejects (Overpayment)', async () => {
    mockInvoiceRepo.findById.mockResolvedValue({
      id: invoiceId,
      status: InvoiceStatus.POSTED,
      balance: 50,
      type: InvoiceType.INVOICE,
    });

    // Mock Guard Failure (Concurrency/Condition Error)
    const err: any = new Error('Create failed');
    err.code = 'P2025';
    mockInvoiceRepo.decreaseBalanceWithGuard.mockRejectedValue(err);

    await expect(
      service.create(companyId, {
        invoiceId,
        amount: 100,
        method: 'CASH',
      })
    ).rejects.toThrow(
      'Payment amount (100) exceeds remaining balance'
    );
  });
});
