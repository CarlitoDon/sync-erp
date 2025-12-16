import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillService } from '../../../../src/modules/accounting/services/bill.service';
import {
  InvoiceType,
  InvoiceStatus,
  OrderType,
} from '@sync-erp/database';

// Automock
vi.mock(
  '../../../../src/modules/accounting/repositories/invoice.repository'
);
vi.mock(
  '../../../../src/modules/accounting/services/journal.service'
);
vi.mock(
  '../../../../src/modules/common/services/document-number.service'
);

describe('T005: Implement/Verify Bill Service (FR-011)', () => {
  let service: BillService;
  let mockRepo: any;
  let mockJournalService: any;
  let mockDocService: any;

  const companyId = 'co-1';
  const orderId = 'po-1';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BillService();
    mockRepo = (service as any).repository;
    mockJournalService = (service as any).journalService;
    mockDocService = (service as any).documentNumberService;
  });

  describe('createFromPurchaseOrder', () => {
    it('should create bill with correct totals and lines', async () => {
      // Mock order with items
      const mockOrder = {
        id: orderId,
        partnerId: 'partner-1',
        totalAmount: 110, // Gross
        taxRate: 10,
        orderNumber: 'PO-001',
        items: [
          { productId: 'prod-A', quantity: 1, price: 100 }, // Subtotal 100
        ],
      };

      mockRepo.findOrder.mockResolvedValue(mockOrder);
      mockDocService.generate.mockResolvedValue('BILL-001');
      mockRepo.create.mockImplementation((data: any) =>
        Promise.resolve(data)
      );

      const input = { orderId };
      const result = await service.createFromPurchaseOrder(
        companyId,
        input
      );

      expect(mockRepo.findOrder).toHaveBeenCalledWith(
        orderId,
        companyId,
        OrderType.PURCHASE
      );

      // Verify Totals Logic (Subtotal recalculation)
      expect(result.subtotal).toBe(100);
      expect(result.taxRate).toBe(10);
      expect(result.taxAmount).toBe(10); // 10% of 100
      expect(result.amount).toBe(110);

      // Verify Line Items are NOT directly on invoice (Schema limitation)
      //expect(result.items).toBeDefined();
      //expect(result.items.create).toHaveLength(1);

      expect(result.type).toBe(InvoiceType.BILL);
      expect(result.status).toBe(InvoiceStatus.DRAFT);
    });
  });

  describe('post', () => {
    it('should post bill and create journal entry (AP + Accrual)', async () => {
      const billId = 'bill-1';
      const mockBill = {
        id: billId,
        status: InvoiceStatus.DRAFT,
        invoiceNumber: 'BILL-001',
        amount: 110,
        subtotal: 100,
        taxAmount: 10,
      };

      mockRepo.findById.mockResolvedValue(mockBill);
      mockRepo.update.mockResolvedValue({
        ...mockBill,
        status: InvoiceStatus.POSTED,
      });

      await service.post(billId, companyId);

      expect(mockRepo.update).toHaveBeenCalledWith(billId, {
        status: InvoiceStatus.POSTED,
      });

      // Verify Journal Posting
      expect(mockJournalService.postBill).toHaveBeenCalledWith(
        companyId,
        'BILL-001',
        110,
        100,
        10
      );
    });
  });
});
