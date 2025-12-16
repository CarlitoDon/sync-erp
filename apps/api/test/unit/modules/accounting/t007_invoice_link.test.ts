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
vi.mock('../../../../src/modules/inventory/inventory.service');

describe('T007: Implement Invoice-Stock Link (FR-008)', () => {
  let service: InvoiceService;
  let mockRepo: any;
  let mockJournalService: any;
  let mockInventoryService: any;

  const companyId = 'co-1';
  const invoiceId = 'inv-1';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InvoiceService();
    mockRepo = (service as any).repository;
    mockInventoryService = (service as any).inventoryService;
    mockJournalService = (service as any).journalService;
  });

  describe('post', () => {
    it('should trigger processShipment when posting Sales Invoice', async () => {
      const mockInvoice = {
        id: invoiceId,
        status: InvoiceStatus.DRAFT,
        type: InvoiceType.INVOICE,
        invoiceNumber: 'INV-001',
        orderId: 'so-1', // Linked Sales Order
        amount: 100,
        subtotal: 100,
        taxAmount: 0,
      };

      mockRepo.findById.mockResolvedValue(mockInvoice);
      mockRepo.update.mockResolvedValue({
        ...mockInvoice,
        status: InvoiceStatus.POSTED,
      });

      // Mock processShipment success
      mockInventoryService.processShipment.mockResolvedValue([]);

      await service.post(invoiceId, companyId, BusinessShape.RETAIL);

      // Verify processShipment called
      expect(
        mockInventoryService.processShipment
      ).toHaveBeenCalledWith(
        companyId,
        'so-1',
        expect.stringContaining('Shipment for Invoice'),
        BusinessShape.RETAIL,
        undefined
      );

      // Verify Update Status
      expect(mockRepo.update).toHaveBeenCalledWith(invoiceId, {
        status: InvoiceStatus.POSTED,
      });

      // Verify Journal
      expect(mockJournalService.postInvoice).toHaveBeenCalled();
    });

    it('should fail to post if shipment fails (e.g. insufficient stock)', async () => {
      const mockInvoice = {
        id: invoiceId,
        status: InvoiceStatus.DRAFT,
        type: InvoiceType.INVOICE,
        invoiceNumber: 'INV-001',
        orderId: 'so-1',
      };
      mockRepo.findById.mockResolvedValue(mockInvoice);

      // Mock processShipment failure due to Policy/Stock
      mockInventoryService.processShipment.mockRejectedValue(
        new Error('Insufficient Stock')
      );

      await expect(
        service.post(invoiceId, companyId)
      ).rejects.toThrow('Insufficient Stock');

      // Verify NO update and NO journal
      expect(mockRepo.update).not.toHaveBeenCalled();
      expect(mockJournalService.postInvoice).not.toHaveBeenCalled();
    });
  });
});
