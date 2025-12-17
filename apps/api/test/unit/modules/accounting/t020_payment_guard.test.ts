import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService } from '../../../../src/modules/accounting/services/payment.service';

// Mock dependencies
vi.mock(
  '../../../../src/modules/accounting/repositories/payment.repository'
);
vi.mock(
  '../../../../src/modules/accounting/repositories/invoice.repository'
);
vi.mock(
  '../../../../src/modules/common/services/idempotency.service'
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

describe('T020: Payment Concurrency Guard', () => {
  let service: PaymentService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSaga.execute.mockClear();
    service = new PaymentService();
  });

  const companyId = 'co-1';
  const invoiceId = 'inv-1';

  it('should delegate to Saga for atomic processing', async () => {
    mockSaga.execute.mockResolvedValue({
      success: true,
      data: { id: 'pay-1' },
    });

    await service.create(companyId, {
      invoiceId,
      amount: 50,
      method: 'CASH',
    });

    expect(mockSaga.execute).toHaveBeenCalled();
  });

  it('should propagate Saga overpayment error', async () => {
    mockSaga.execute.mockResolvedValue({
      success: false,
      error: new Error(
        'Payment amount (100) exceeds remaining balance'
      ),
    });

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
