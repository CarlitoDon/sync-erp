import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryService } from '../../../../src/modules/inventory/inventory.service';
import { BusinessShape } from '@sync-erp/database';

// Automock dependencies
vi.mock('../../../../src/modules/inventory/inventory.repository');
vi.mock('../../../../src/modules/product/product.service');
vi.mock('../../../../src/modules/procurement/procurement.service');
vi.mock(
  '../../../../src/modules/accounting/services/journal.service'
);

// Mock Prisma module fully
vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');
  return {
    ...actual,
    prisma: {
      order: {
        findFirst: vi.fn(),
      },
      orderItem: {
        update: vi.fn(),
      },
    },
  };
});

describe('T001: Verify Stock Movements', () => {
  let service: InventoryService;
  // Access mocked dependencies
  let mockRepo: any;
  let mockProductService: any;
  let mockProcurementService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InventoryService();
    // Access the automocked instances that the service constructor received
    mockRepo = (service as any).repository;
    mockProductService = (service as any).productService;
    mockProcurementService = (service as any).procurementService;
  });

  describe('FR-001 & FR-003: Goods Receipt (Stock IN + AVG Cost)', () => {
    const companyId = 'co-1';
    const orderId = 'po-1';
    const input = {
      orderId,
      reference: 'GR-001',
      date: new Date(),
      items: [
        {
          id: 'item-A',
          productId: 'prod-A',
          quantity: 10,
          cost: 1000,
        },
        {
          id: 'item-B',
          productId: 'prod-B',
          quantity: 5,
          cost: 2000,
        },
      ],
    };

    it('should increase stock and recalculate average cost for each item', async () => {
      // Setup scenarios
      mockProcurementService.getById.mockResolvedValue({
        id: orderId,
        status: 'CONFIRMED',
      });
      mockProcurementService.getItems.mockResolvedValue([
        { productId: 'prod-A', quantity: 10, price: 1000 },
        { productId: 'prod-B', quantity: 5, price: 2000 },
      ]);
      mockProductService.getById.mockResolvedValue({
        averageCost: 500,
      }); // Valid product

      await service.processGoodsReceipt(
        companyId,
        input,
        BusinessShape.RETAIL
      );

      // Verify Stock Movement Creation
      expect(mockRepo.createMovement).toHaveBeenCalledTimes(2);
      expect(mockRepo.createMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-A',
          type: 'IN',
          quantity: 10,
        }),
        undefined
      );

      // Verify AVG Cost Recalculation (FR-003)
      expect(
        mockProductService.updateAverageCost
      ).toHaveBeenCalledTimes(2);
      expect(
        mockProductService.updateAverageCost
      ).toHaveBeenCalledWith('prod-A', 10, 1000, undefined);
      expect(
        mockProductService.updateAverageCost
      ).toHaveBeenCalledWith('prod-B', 5, 2000, undefined);
    });
  });

  describe('FR-002: Shipment (Stock OUT)', () => {
    it('should decrease stock and create shipment movement', async () => {
      const companyId = 'co-1';
      const orderId = 'so-1';
      const orderItems = [
        { id: 'item-1', productId: 'prod-A', quantity: 2 },
        { id: 'item-2', productId: 'prod-B', quantity: 1 },
      ];

      // Mock repository.findOrderWithItems (used by InventoryService.processShipment)
      mockRepo.findOrderWithItems.mockResolvedValue({
        id: orderId,
        companyId,
        orderNumber: 'SO-001',
        items: orderItems,
      } as any);

      mockProductService.checkStock.mockResolvedValue(true);
      mockProductService.getById.mockResolvedValue({
        id: 'prod-A',
        name: 'Product A',
        stockQty: 100,
        averageCost: 500,
      });
      mockProductService.decreaseStock.mockResolvedValue({});

      await service.processShipment(companyId, orderId);

      // Verify Stock Decrease
      expect(mockProductService.decreaseStock).toHaveBeenCalledTimes(
        2
      );
      expect(mockProductService.decreaseStock).toHaveBeenCalledWith(
        'prod-A',
        2,
        undefined
      );
      expect(mockProductService.decreaseStock).toHaveBeenCalledWith(
        'prod-B',
        1,
        undefined
      );

      // Verify Movement Creation
      expect(mockRepo.createMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'OUT',
          productId: 'prod-A',
          quantity: 2,
        }),
        undefined
      );
    });
  });
});
