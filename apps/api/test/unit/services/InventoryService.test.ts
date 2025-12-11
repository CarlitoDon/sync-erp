import { vi } from 'vitest';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

// Mock the database module

// Mock dependent services
vi.mock('../../../src/services/ProductService', () => ({
  ProductService: vi.fn().mockImplementation(() => ({
    updateAverageCost: vi.fn().mockResolvedValue({}),
    updateStock: vi.fn().mockResolvedValue({}),
    checkStock: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('../../../src/services/PurchaseOrderService', () => ({
  PurchaseOrderService: vi.fn().mockImplementation(() => ({
    getById: vi.fn(),
    getItems: vi.fn(),
    complete: vi.fn(),
  })),
}));

vi.mock('../../../src/services/JournalService', () => ({
  JournalService: vi.fn().mockImplementation(() => ({
    postGoodsReceipt: vi.fn().mockResolvedValue({}),
    postShipment: vi.fn().mockResolvedValue({}),
    postSalesReturn: vi.fn().mockResolvedValue({}),
    postAdjustment: vi.fn().mockResolvedValue({}),
  })),
}));

// Add inventoryMovement to mock
(mockPrisma as any).inventoryMovement = {
  create: vi.fn(),
  findMany: vi.fn(),
};

// Import after mocking
import { InventoryService } from '../../../src/services/InventoryService';

describe('InventoryService', () => {
  let service: InventoryService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
    service = new InventoryService();
  });

  describe('processGoodsReceipt', () => {
    it('should process goods receipt for a purchase order', async () => {
      const mockOrder = { id: 'order-1', orderNumber: 'PO-001' };
      const mockItems = [
        { productId: 'prod-1', quantity: 10, price: 100 },
        { productId: 'prod-2', quantity: 5, price: 50 },
      ];
      const mockMovement = { id: 'mov-1', type: 'IN', quantity: 10 };

      (service as any).purchaseOrderService.getById = vi.fn().mockResolvedValue(mockOrder);
      (service as any).purchaseOrderService.getItems = vi.fn().mockResolvedValue(mockItems);
      (service as any).purchaseOrderService.complete = vi.fn().mockResolvedValue(mockOrder);
      (mockPrisma as any).inventoryMovement.create.mockResolvedValue(mockMovement);

      const result = await service.processGoodsReceipt(companyId, { orderId: 'order-1' });

      expect(result).toHaveLength(2);
      expect((service as any).purchaseOrderService.complete).toHaveBeenCalled();
    });

    it('should throw error if order not found', async () => {
      (service as any).purchaseOrderService.getById = vi.fn().mockResolvedValue(null);

      await expect(
        service.processGoodsReceipt(companyId, { orderId: 'nonexistent' })
      ).rejects.toThrow('Purchase order not found');
    });
  });

  describe('processShipment', () => {
    it('should process shipment and decrease stock', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'SO-001',
        items: [{ productId: 'prod-1', quantity: 5 }],
      };
      const mockProduct = { id: 'prod-1', averageCost: 100 };
      const mockMovement = { id: 'mov-1', type: 'OUT', quantity: 5 };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      (mockPrisma as any).inventoryMovement.create.mockResolvedValue(mockMovement);

      const result = await service.processShipment(companyId, 'order-1');

      expect(result).toHaveLength(1);
    });

    it('should throw error if order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(service.processShipment(companyId, 'nonexistent')).rejects.toThrow(
        'Order not found'
      );
    });

    it('should throw error if insufficient stock', async () => {
      const mockOrder = {
        id: 'order-1',
        items: [{ productId: 'prod-1', quantity: 100 }],
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      (service as any).productService.checkStock = vi.fn().mockResolvedValue(false);

      await expect(service.processShipment(companyId, 'order-1')).rejects.toThrow(
        'Insufficient stock'
      );
    });
  });

  describe('processReturn', () => {
    it('should process sales return and increase stock', async () => {
      const mockOrder = { id: 'order-1', orderNumber: 'SO-001' };
      const mockProduct = { id: 'prod-1', averageCost: 100 };
      const mockMovement = { id: 'mov-1', type: 'IN', quantity: 2 };
      const items = [{ productId: 'prod-1', quantity: 2 }];

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      (mockPrisma as any).inventoryMovement.create.mockResolvedValue(mockMovement);

      const result = await service.processReturn(companyId, 'order-1', items);

      expect(result).toHaveLength(1);
    });

    it('should throw error if order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.processReturn(companyId, 'nonexistent', [{ productId: 'prod-1', quantity: 1 }])
      ).rejects.toThrow('Order not found');
    });
  });

  describe('adjustStock', () => {
    it('should create positive adjustment (stock gain)', async () => {
      const mockProduct = { id: 'prod-1', stockQty: 10, averageCost: 50 };
      const mockMovement = { id: 'mov-1', type: 'IN', quantity: 5 };

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      (mockPrisma as any).inventoryMovement.create.mockResolvedValue(mockMovement);

      const result = await service.adjustStock(companyId, {
        productId: 'prod-1',
        quantity: 5,
        costPerUnit: 60,
      });

      expect(result).toEqual(mockMovement);
    });

    it('should create negative adjustment (stock loss)', async () => {
      const mockProduct = { id: 'prod-1', stockQty: 10, averageCost: 50 };
      const mockMovement = { id: 'mov-1', type: 'OUT', quantity: 3 };

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      (mockPrisma as any).inventoryMovement.create.mockResolvedValue(mockMovement);

      const result = await service.adjustStock(companyId, {
        productId: 'prod-1',
        quantity: -3,
        costPerUnit: 50,
      });

      expect(result).toEqual(mockMovement);
    });

    it('should throw error if product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.adjustStock(companyId, { productId: 'nonexistent', quantity: 5, costPerUnit: 10 })
      ).rejects.toThrow('Product not found');
    });

    it('should throw error if insufficient stock for negative adjustment', async () => {
      const mockProduct = { id: 'prod-1', stockQty: 5, averageCost: 50 };

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      await expect(
        service.adjustStock(companyId, { productId: 'prod-1', quantity: -10, costPerUnit: 50 })
      ).rejects.toThrow('Insufficient stock');
    });
  });

  describe('getMovements', () => {
    it('should return all movements for a company', async () => {
      const mockMovements = [
        { id: 'mov-1', type: 'IN' },
        { id: 'mov-2', type: 'OUT' },
      ];

      (mockPrisma as any).inventoryMovement.findMany.mockResolvedValue(mockMovements);

      const result = await service.getMovements(companyId);

      expect(result).toHaveLength(2);
    });

    it('should filter by productId', async () => {
      const mockMovements = [{ id: 'mov-1', productId: 'prod-1', type: 'IN' }];

      (mockPrisma as any).inventoryMovement.findMany.mockResolvedValue(mockMovements);

      const result = await service.getMovements(companyId, 'prod-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getStockLevels', () => {
    it('should return stock levels for all products', async () => {
      const mockProducts = [
        { id: 'prod-1', sku: 'SKU1', name: 'Product 1', stockQty: 10 },
        { id: 'prod-2', sku: 'SKU2', name: 'Product 2', stockQty: 5 },
      ];

      mockPrisma.product.findMany.mockResolvedValue(mockProducts);

      const result = await service.getStockLevels(companyId);

      expect(result).toHaveLength(2);
    });
  });
});
