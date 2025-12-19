import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  mockInventoryRepository,
  resetRepositoryMocks,
} from '../mocks/repositories.mock';

// Mock ProductService
const mockProductService = {
  updateAverageCost: vi.fn().mockResolvedValue({}),
  updateStock: vi.fn().mockResolvedValue({}),
  checkStock: vi.fn().mockResolvedValue(true),
  getById: vi.fn(),
  list: vi.fn(),
};
vi.mock('@modules/product/product.service', () => ({
  ProductService: function () {
    return mockProductService;
  },
}));

// Mock ProcurementService
const mockProcurementService = {
  getById: vi.fn(),
  getItems: vi.fn(),
  complete: vi.fn(),
};
vi.mock('@modules/procurement/procurement.service', () => ({
  ProcurementService: function () {
    return mockProcurementService;
  },
}));

// Mock JournalService
const mockJournalService = {
  postGoodsReceipt: vi.fn().mockResolvedValue({}),
  postShipment: vi.fn().mockResolvedValue({}),
  postSalesReturn: vi.fn().mockResolvedValue({}),
  postAdjustment: vi.fn().mockResolvedValue({}),
};
vi.mock('@modules/accounting/services/journal.service', () => ({
  JournalService: function () {
    return mockJournalService;
  },
}));

// Mock InventoryRepository
vi.mock('@modules/inventory/inventory.repository', () => ({
  InventoryRepository: function () {
    return mockInventoryRepository;
  },
}));

// Import after mocking
import { InventoryService } from '@modules/inventory/inventory.service';

describe('InventoryService', () => {
  let service: InventoryService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetRepositoryMocks();
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

      mockProcurementService.getById.mockResolvedValue(mockOrder);
      mockProcurementService.getItems.mockResolvedValue(mockItems);
      mockProcurementService.complete.mockResolvedValue(mockOrder);
      mockInventoryRepository.createMovement.mockResolvedValue(
        mockMovement
      );

      const result = await service.processGoodsReceipt(companyId, {
        orderId: 'order-1',
      });

      expect(result).toHaveLength(2);
      expect(mockProcurementService.complete).toHaveBeenCalled();
    });

    it('should throw error if order not found', async () => {
      mockProcurementService.getById.mockResolvedValue(null);

      await expect(
        service.processGoodsReceipt(companyId, {
          orderId: 'nonexistent',
        })
      ).rejects.toThrow('Purchase order not found');
    });
  });

  describe('getMovements', () => {
    it('should return all movements for a company', async () => {
      const mockMovements = [
        { id: 'mov-1', type: 'IN' },
        { id: 'mov-2', type: 'OUT' },
      ];

      mockInventoryRepository.findMovements.mockResolvedValue(
        mockMovements
      );

      const result = await service.getMovements(companyId);

      expect(result).toHaveLength(2);
    });

    it('should filter by productId', async () => {
      const mockMovements = [
        { id: 'mov-1', productId: 'prod-1', type: 'IN' },
      ];

      mockInventoryRepository.findMovements.mockResolvedValue(
        mockMovements
      );

      const result = await service.getMovements(companyId, 'prod-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getStockLevels', () => {
    it('should return stock levels from ProductService', async () => {
      const mockProducts = [
        { id: 'prod-1', stockQty: 100 },
        { id: 'prod-2', stockQty: 50 },
      ];
      mockProductService.list = vi
        .fn()
        .mockResolvedValue(mockProducts);

      const result = await service.getStockLevels(companyId);

      expect(result).toEqual(mockProducts);
    });
  });

  describe('adjustStock', () => {
    it('should process positive adjustment (stock gain)', async () => {
      const mockProduct = {
        id: 'prod-1',
        stockQty: 100,
        averageCost: 50,
      };
      const mockMovement = { id: 'mov-1', type: 'IN', quantity: 10 };

      mockProductService.getById.mockResolvedValue(mockProduct);
      mockInventoryRepository.createMovement.mockResolvedValue(
        mockMovement
      );

      const result = await service.adjustStock(companyId, {
        productId: 'prod-1',
        quantity: 10,
        costPerUnit: 55,
        reference: 'ADJ-001',
      });

      expect(result).toEqual(mockMovement);
      expect(
        mockProductService.updateAverageCost
      ).toHaveBeenCalledWith('prod-1', 10, 55, undefined);
      expect(mockJournalService.postAdjustment).toHaveBeenCalled();
    });

    it('should process negative adjustment (stock loss)', async () => {
      const mockProduct = {
        id: 'prod-1',
        stockQty: 100,
        averageCost: 50,
      };
      const mockMovement = { id: 'mov-1', type: 'OUT', quantity: 5 };

      mockProductService.getById.mockResolvedValue(mockProduct);
      mockInventoryRepository.createMovement.mockResolvedValue(
        mockMovement
      );

      const result = await service.adjustStock(companyId, {
        productId: 'prod-1',
        quantity: -5,
        costPerUnit: 50,
        reference: 'ADJ-002',
      });

      expect(result).toEqual(mockMovement);
      expect(mockProductService.updateStock).toHaveBeenCalledWith(
        'prod-1',
        -5,
        undefined
      );
      expect(mockJournalService.postAdjustment).toHaveBeenCalledWith(
        companyId,
        'ADJ-002',
        250, // 5 * 50 averageCost
        true, // isLoss
        undefined
      );
    });

    it('should throw error if product not found', async () => {
      mockProductService.getById.mockResolvedValue(null);

      await expect(
        service.adjustStock(companyId, {
          productId: 'nonexistent',
          quantity: 10,
          costPerUnit: 50,
        })
      ).rejects.toThrow('Product not found');
    });

    it('should throw error if insufficient stock for negative adjustment', async () => {
      const mockProduct = {
        id: 'prod-1',
        stockQty: 5,
        averageCost: 50,
      };
      mockProductService.getById.mockResolvedValue(mockProduct);

      await expect(
        service.adjustStock(companyId, {
          productId: 'prod-1',
          quantity: -10, // More than current stock
          costPerUnit: 50,
        })
      ).rejects.toThrow('Insufficient stock');
    });
  });
});
