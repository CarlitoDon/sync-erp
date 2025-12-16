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
vi.mock(
  '../../../../src/modules/common/services/document-number.service'
);
vi.mock('../../../../src/modules/inventory/inventory.service');

describe('T014: Invoice Idempotency (FR-Safety)', () => {
  let service: InvoiceService;
  let mockIdempotency: any;
  let mockRepo: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InvoiceService();
    // Access privates via any
    mockIdempotency = (service as any).idempotencyService;
    mockRepo = (service as any).repository;
  });

  const companyId = 'co-1';
  const invoiceId = 'inv-1';

  it('should execute post logic if key is new', async () => {
    // 1. Lock returns saved=false
    mockIdempotency.lock.mockResolvedValue({ saved: false });

    // 2. Repo finds invoice
    mockRepo.findById.mockResolvedValue({
      id: invoiceId,
      status: InvoiceStatus.DRAFT,
      invoiceNumber: 'INV-001',
      orderId: null,
    });

    // 3. Repo updates
    mockRepo.update.mockResolvedValue({
      id: invoiceId,
      status: InvoiceStatus.POSTED,
      invoiceNumber: 'INV-001',
      amount: 100,
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

    // Verify Update called
    expect(mockRepo.update).toHaveBeenCalled();

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

    // Verify Repo/Logic NOT called
    expect(mockRepo.findById).not.toHaveBeenCalled();
    expect(mockRepo.update).not.toHaveBeenCalled();

    expect(result).toEqual(cachedInvoice);
  });

  it('should release lock (fail) if logic throws', async () => {
    // 1. Lock returns saved=false
    mockIdempotency.lock.mockResolvedValue({ saved: false });

    // 2. Logic throws (e.g. Invoice not found)
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      service.post(
        invoiceId,
        companyId,
        undefined,
        undefined,
        'key-123'
      )
    ).rejects.toThrow('Invoice not found');

    // Verify Fail called
    expect(mockIdempotency.fail).toHaveBeenCalledWith('key-123');
  });
});
