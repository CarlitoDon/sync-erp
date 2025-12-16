import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService } from '../../../../src/modules/accounting/services/payment.service';
import {
  InvoiceStatus,
  InvoiceType,
  IdempotencyScope,
} from '@sync-erp/database';

// Mock dependencies
vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');
  return {
    ...actual,
    prisma: {
      payment: { create: vi.fn() },
      invoice: { findUnique: vi.fn(), update: vi.fn() },
    },
  };
});
vi.mock(
  '../../../../src/modules/common/services/idempotency.service'
);
vi.mock(
  '../../../../src/modules/accounting/repositories/payment.repository'
);
vi.mock(
  '../../../../src/modules/accounting/repositories/invoice.repository'
);
vi.mock(
  '../../../../src/modules/accounting/services/journal.service'
);

describe('T015: Payment Idempotency (FR-Safety)', () => {
  let service: PaymentService;
  let mockIdempotency: any;
  let mockRepo: any;
  let mockInvoiceRepo: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentService();
    // Access privates via any
    mockIdempotency = (service as any).idempotencyService;
    mockRepo = (service as any).repository;
    mockInvoiceRepo = (service as any).invoiceRepository;
  });

  const companyId = 'co-1';
  const invoiceId = 'inv-1';
  const input = { invoiceId, amount: 50, method: 'CASH' };

  it('should execute payment logic if key is new', async () => {
    // 1. Lock returns saved=false
    mockIdempotency.lock.mockResolvedValue({ saved: false });

    // 2. Invoice Repo finds invoice
    mockInvoiceRepo.findById.mockResolvedValue({
      id: invoiceId,
      status: InvoiceStatus.POSTED,
      invoiceNumber: 'INV-001',
      balance: 100,
      type: InvoiceType.INVOICE,
    });

    // 3. Mock atomic balance decrease (concurrency guard)
    mockInvoiceRepo.decreaseBalanceWithGuard.mockResolvedValue({
      id: invoiceId,
      balance: 50, // 100 - 50
    });

    // 4. Payment Repo creates
    mockRepo.create.mockResolvedValue({ id: 'pay-1', amount: 50 });

    const result = await service.create(companyId, input, 'key-abc');

    // Verify lock called with enum
    expect(mockIdempotency.lock).toHaveBeenCalledWith(
      'key-abc',
      companyId,
      IdempotencyScope.PAYMENT_CREATE
    );

    // Verify Business Logic executed
    expect(mockRepo.create).toHaveBeenCalled();
    expect(
      mockInvoiceRepo.decreaseBalanceWithGuard
    ).toHaveBeenCalled();

    // Verify Complete called
    expect(mockIdempotency.complete).toHaveBeenCalledWith(
      'key-abc',
      expect.objectContaining({ id: 'pay-1' })
    );

    expect(result.id).toBe('pay-1');
  });

  it('should return cached response if key exists', async () => {
    const cachedPayment = { id: 'pay-1', amount: 50 };
    mockIdempotency.lock.mockResolvedValue({
      saved: true,
      response: cachedPayment,
    });

    const result = await service.create(companyId, input, 'key-abc');

    // Verify Logic NOT called
    expect(mockRepo.create).not.toHaveBeenCalled();

    expect(result).toEqual(cachedPayment);
  });

  it('should release lock (fail) if logic throws', async () => {
    mockIdempotency.lock.mockResolvedValue({ saved: false });

    // Simulate error (e.g. Invoice not found)
    mockInvoiceRepo.findById.mockResolvedValue(null);

    await expect(
      service.create(companyId, input, 'key-abc')
    ).rejects.toThrow('Invoice not found');

    expect(mockIdempotency.fail).toHaveBeenCalledWith('key-abc');
  });
});
