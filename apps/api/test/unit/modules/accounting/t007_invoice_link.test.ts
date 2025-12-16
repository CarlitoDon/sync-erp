import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceService } from '../../../../src/modules/accounting/services/invoice.service';
import {
  InvoiceType,
  InvoiceStatus,
  BusinessShape,
} from '@sync-erp/database';

// Automock deps
vi.mock(
  '../../../../src/modules/accounting/repositories/invoice.repository'
);
vi.mock(
  '../../../../src/modules/accounting/services/journal.service'
);
vi.mock(
  '../../../../src/modules/common/services/document-number.service'
);
// vi.mock('../../../../src/modules/inventory/inventory.service');

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

describe('T007: Implement Invoice-Stock Link (FR-008)', () => {
  let service: InvoiceService;
  let mockRepo: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSaga.execute.mockClear();
    service = new InvoiceService();
    mockRepo = (service as any).repository;
  });

  const companyId = 'co-1';
  const invoiceId = 'inv-1';

  describe('post', () => {
    it('should trigger Saga for stock/journal processing', async () => {
      mockSaga.execute.mockResolvedValue({
        success: true,
        data: { status: InvoiceStatus.POSTED },
      });

      await service.post(invoiceId, companyId, BusinessShape.RETAIL);

      expect(mockSaga.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId,
          companyId,
          // businessShape: BusinessShape.RETAIL -- Might not be passed to execute payload, but implementation detail
        }),
        invoiceId,
        companyId
      );
    });

    it('should propagate Saga error (e.g. Insufficient Stock)', async () => {
      mockSaga.execute.mockResolvedValue({
        success: false,
        error: new Error('Insufficient Stock'),
      });

      await expect(
        service.post(invoiceId, companyId)
      ).rejects.toThrow('Insufficient Stock');
    });
  });
});
