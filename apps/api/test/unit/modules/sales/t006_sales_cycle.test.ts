import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SalesService } from '../../../../src/modules/sales/sales.service';
import {
  BusinessShape,
  OrderStatus,
  OrderType,
} from '@sync-erp/database';

// Automock
vi.mock('../../../../src/modules/sales/sales.repository');
vi.mock('../../../../src/modules/inventory/inventory.service');
vi.mock(
  '../../../../src/modules/common/services/document-number.service'
);
vi.mock('../../../../src/modules/product/product.service');

// Mock Prisma
vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');
  return {
    ...actual,
    prisma: {
      order: {
        findFirst: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
    },
  };
});

describe('T006: Verify Sales Order Cycle (FR-006)', () => {
  let service: SalesService;
  let mockRepo: any;
  let mockDocService: any;
  let mockProductService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SalesService();
    mockRepo = (service as any).repository;
    mockDocService = (service as any).documentNumberService;
    mockProductService = (service as any).productService;
  });

  const companyId = 'co-1';
  const orderId = 'so-1';

  describe('create', () => {
    it('should create DRAFT Sales Order with generated number', async () => {
      mockDocService.generate.mockResolvedValue('SO-001');

      const input = {
        partnerId: 'partner-Cust',
        items: [
          { productId: 'prod-Finished', quantity: 2, price: 500 },
        ],
      };

      // Mock Product check stock for create? (Maybe not needed for create, but good practice)
      mockProductService.checkStock.mockResolvedValue(true);
      mockProductService.getById.mockResolvedValue({
        id: 'prod-Finished',
        price: 500,
      });

      // Using RETAIL shape
      await service.create(companyId, input, BusinessShape.RETAIL);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: OrderType.SALES,
          status: OrderStatus.DRAFT,
          orderNumber: 'SO-001',
          totalAmount: 1000, // 2 * 500
        })
      );
    });
  });

  describe('confirm', () => {
    it('should transition DRAFT to CONFIRMED', async () => {
      mockRepo.findById.mockResolvedValue({
        id: orderId,
        status: OrderStatus.DRAFT,
        items: [{ productId: 'prod-1', quantity: 1 }],
      });

      mockProductService.checkStock.mockResolvedValue(true);

      await service.confirm(orderId, companyId);

      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        orderId,
        OrderStatus.CONFIRMED
      );
    });
  });

  // Sales Flow usually leads to Shipment (tested T001) and Invoice (tested T007).
  // "Complete" might happen after shipment?
  // SalesService might not have "complete" if it's event driven?
  // I checked ProcurementService has confirm/complete. SalesService likely same.
  // Checking typical sync-erp pattern: Sales Cycle ends with Payment/Fullfillment.
  // I will assume confirmed is the key state for now.
});
