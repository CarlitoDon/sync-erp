import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceService } from '../../../../src/modules/accounting/services/invoice.service';
import { InvoiceStatus, IdempotencyScope } from '@sync-erp/database';

// Mock dependencies
vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');
  return {
    ...actual,
    prisma: {
      invoice: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      order: { findUnique: vi.fn() },
    },
  };
});
vi.mock(
  '../../../../src/modules/common/services/idempotency.service'
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
  '../../../../src/modules/accounting/sagas/invoice-posting.saga',
  () => ({
    InvoicePostingSaga: function () {
      return mockSaga;
    },
  })
);

vi.mock(
  '../../../../src/modules/common/services/document-number.service'
);
vi.mock('../../../../src/modules/inventory/inventory.service');

describe('T014: Invoice Idempotency (FR-Safety)', () => {
  let service: InvoiceService;
  let mockIdempotency: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSaga.execute.mockClear(); // Clear saga mock
    service = new InvoiceService();
    // Access privates via any
    mockIdempotency = (service as any).idempotencyService;
  });

  const companyId = 'co-1';
  const invoiceId = 'inv-1';

  it('should execute post logic if key is new', async () => {
    // 1. Lock returns saved=false
    mockIdempotency.lock.mockResolvedValue({ saved: false });

    // 2. Saga returns success
    mockSaga.execute.mockResolvedValue({
      success: true,
      data: {
        id: invoiceId,
        status: InvoiceStatus.POSTED,
        invoiceNumber: 'INV-001',
      },
    });

    const result = await service.post(
      invoiceId,
      companyId,
      undefined,
      undefined,
      'key-123'
    );

    // Verify lock called with enum
    expect(mockIdempotency.lock).toHaveBeenCalledWith(
      'key-123',
      companyId,
      IdempotencyScope.INVOICE_POST
    );

    // Verify Saga Called
    expect(mockSaga.execute).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId, companyId }),
      invoiceId,
      companyId
    );

    // Verify Complete called
    expect(mockIdempotency.complete).toHaveBeenCalledWith(
      'key-123',
      expect.objectContaining({ status: 'POSTED' })
    );

    expect(result.status).toBe(InvoiceStatus.POSTED);
  });

  it('should return cached response if key exists (saved=true)', async () => {
    const cachedInvoice = {
      id: invoiceId,
      status: InvoiceStatus.POSTED,
    };

    // 1. Lock returns saved=true
    mockIdempotency.lock.mockResolvedValue({
      saved: true,
      response: cachedInvoice,
    });

    const result = await service.post(
      invoiceId,
      companyId,
      undefined,
      undefined,
      'key-123'
    );

    // Verify Saga NOT called
    expect(mockSaga.execute).not.toHaveBeenCalled();

    expect(result).toEqual(cachedInvoice);
  });

  it('should release lock (fail) if logic throws', async () => {
    // 1. Lock returns saved=false
    mockIdempotency.lock.mockResolvedValue({ saved: false });

    // 2. Logic throws (e.g. Saga fails)
    mockSaga.execute.mockResolvedValue({
      success: false,
      error: new Error('Saga failed'),
    });

    await expect(
      service.post(
        invoiceId,
        companyId,
        undefined,
        undefined,
        'key-123'
      )
    ).rejects.toThrow('Saga failed');

    // Verify Fail called
    expect(mockIdempotency.fail).toHaveBeenCalledWith('key-123');
  });
});
