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

// Mock Saga
const mockSaga = { execute: vi.fn() };
vi.mock(
  '../../../../src/modules/accounting/sagas/payment-posting.saga',
  () => ({
    PaymentPostingSaga: function () {
      return mockSaga;
    },
  })
);

describe('T015: Payment Idempotency (FR-Safety)', () => {
  let service: PaymentService;
  let mockIdempotency: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSaga.execute.mockClear();
    service = new PaymentService();
    // Access privates via any
    mockIdempotency = (service as any).idempotencyService;
  });

  const companyId = 'co-1';
  const invoiceId = 'inv-1';
  const input = { invoiceId, amount: 50, method: 'CASH' };

  it('should execute payment logic if key is new', async () => {
    // 1. Lock returns saved=false
    mockIdempotency.lock.mockResolvedValue({ saved: false });

    // 2. Saga returns success
    mockSaga.execute.mockResolvedValue({
      success: true,
      data: { id: 'pay-1', amount: 50 },
    });

    const result = await service.create(companyId, input, 'key-abc');

    // Verify lock called with enum and entityId
    expect(mockIdempotency.lock).toHaveBeenCalledWith(
      'key-abc',
      companyId,
      IdempotencyScope.PAYMENT_CREATE,
      invoiceId
    );

    // Verify Saga executed
    expect(mockSaga.execute).toHaveBeenCalled();

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
    expect(mockSaga.execute).not.toHaveBeenCalled();

    expect(result).toEqual(cachedPayment);
  });

  it('should release lock (fail) if logic throws', async () => {
    mockIdempotency.lock.mockResolvedValue({ saved: false });

    // Simulate error (e.g. Saga fails)
    mockSaga.execute.mockResolvedValue({
      success: false,
      error: new Error('Saga failed'),
    });

    await expect(
      service.create(companyId, input, 'key-abc')
    ).rejects.toThrow('Saga failed');

    expect(mockIdempotency.fail).toHaveBeenCalledWith('key-abc');
  });
});
