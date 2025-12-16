import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  mockProductRepository,
  resetRepositoryMocks,
} from '../mocks/repositories.mock';

// Mock the ProductRepository module
vi.mock('../../../src/modules/product/product.repository', () => ({
  ProductRepository: function () {
    return mockProductRepository;
  },
}));

// Import after mocking
import { ProductService } from '../../../src/modules/product/product.service';

describe('ProductService', () => {
  let service: ProductService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetRepositoryMocks();
    service = new ProductService();
  });

  describe('create', () => {
    it('should create a new product', async () => {
      const mockProduct = {
        id: 'prod-1',
        companyId,
        sku: 'SKU001',
        name: 'Test Product',
        price: 100,
        stockQty: 0,
        averageCost: 0,
      };

      mockProductRepository.create.mockResolvedValue(mockProduct);

      const result = await service.create(companyId, {
        sku: 'SKU001',
        name: 'Test Product',
        price: 100,
      });

      expect(result).toEqual(mockProduct);
      expect(mockProductRepository.create).toHaveBeenCalledWith({
        companyId,
        sku: 'SKU001',
        name: 'Test Product',
        price: 100,
        averageCost: 0,
        stockQty: 0,
      });
    });
  });

  describe('getById', () => {
    it('should return a product by ID', async () => {
      const mockProduct = { id: 'prod-1', companyId, sku: 'SKU001' };
      mockProductRepository.findById.mockResolvedValue(mockProduct);

      const result = await service.getById('prod-1', companyId);

      expect(result).toEqual(mockProduct);
      expect(mockProductRepository.findById).toHaveBeenCalledWith(
        'prod-1',
        companyId
      );
    });

    it('should return null for non-existent product', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      const result = await service.getById('nonexistent', companyId);

      expect(result).toBeNull();
    });
  });

  describe('getBySku', () => {
    it('should return a product by SKU', async () => {
      const mockProduct = { id: 'prod-1', sku: 'SKU001' };
      mockProductRepository.findBySku.mockResolvedValue(mockProduct);

      const result = await service.getBySku('SKU001', companyId);

      expect(result).toEqual(mockProduct);
    });
  });

  describe('list', () => {
    it('should list all products', async () => {
      const mockProducts = [
        { id: 'prod-1', name: 'Product A' },
        { id: 'prod-2', name: 'Product B' },
      ];
      mockProductRepository.findAll.mockResolvedValue(mockProducts);

      const result = await service.list(companyId);

      expect(result).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update a product', async () => {
      const existingProduct = {
        id: 'prod-1',
        companyId,
        name: 'Old Name',
      };
      const updatedProduct = {
        id: 'prod-1',
        companyId,
        name: 'New Name',
      };

      mockProductRepository.findById.mockResolvedValue(
        existingProduct
      );
      mockProductRepository.update.mockResolvedValue(updatedProduct);

      const result = await service.update('prod-1', companyId, {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
    });

    it('should throw error if product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', companyId, { name: 'New' })
      ).rejects.toThrow('Product not found');
    });
  });

  describe('delete', () => {
    it('should delete a product', async () => {
      const existingProduct = { id: 'prod-1', companyId };
      mockProductRepository.findById.mockResolvedValue(
        existingProduct
      );
      mockProductRepository.delete.mockResolvedValue(existingProduct);

      await service.delete('prod-1', companyId);

      expect(mockProductRepository.delete).toHaveBeenCalledWith(
        'prod-1'
      );
    });

    it('should throw error if product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(
        service.delete('nonexistent', companyId)
      ).rejects.toThrow('Product not found');
    });
  });

  describe('updateStock', () => {
    it('should increment stock quantity', async () => {
      const updatedProduct = { id: 'prod-1', stockQty: 15 };
      mockProductRepository.incrementStock.mockResolvedValue(
        updatedProduct
      );

      const result = await service.updateStock('prod-1', 5);

      expect(result.stockQty).toBe(15);
      expect(
        mockProductRepository.incrementStock
      ).toHaveBeenCalledWith('prod-1', 5);
    });

    it('should decrement stock quantity with negative value', async () => {
      const updatedProduct = { id: 'prod-1', stockQty: 5 };
      mockProductRepository.incrementStock.mockResolvedValue(
        updatedProduct
      );

      const result = await service.updateStock('prod-1', -5);

      expect(result.stockQty).toBe(5);
    });
  });

  describe('updateAverageCost', () => {
    it('should calculate new average cost using AVCO formula', async () => {
      const existingProduct = {
        id: 'prod-1',
        stockQty: 10,
        averageCost: 100, // Total value = 1000
      };

      mockProductRepository.findById.mockResolvedValue(
        existingProduct
      );
      mockProductRepository.update.mockImplementation((id, data) =>
        Promise.resolve({
          id: 'prod-1',
          ...data,
        })
      );

      // Add 10 units at $150 each
      // New AVCO = (10 * 100 + 10 * 150) / 20 = 2500 / 20 = 125
      await service.updateAverageCost('prod-1', 10, 150);

      expect(mockProductRepository.update).toHaveBeenCalledWith(
        'prod-1',
        expect.objectContaining({
          averageCost: 125,
          stockQty: { increment: 10 },
        })
      );
    });

    it('should throw error if product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateAverageCost('nonexistent', 10, 100)
      ).rejects.toThrow('Product not found');
    });

    it('should use newCostPerUnit when starting from zero stock', async () => {
      const existingProduct = {
        id: 'prod-1',
        stockQty: 0,
        averageCost: 0,
      };
      mockProductRepository.findById.mockResolvedValue(
        existingProduct
      );
      mockProductRepository.update.mockResolvedValue({
        id: 'prod-1',
        averageCost: 50,
      });

      await service.updateAverageCost('prod-1', 10, 50);

      expect(mockProductRepository.update).toHaveBeenCalledWith(
        'prod-1',
        expect.objectContaining({
          averageCost: 50,
        })
      );
    });
  });

  describe('checkStock', () => {
    it('should return true when stock is sufficient', async () => {
      mockProductRepository.findById.mockResolvedValue({
        id: 'prod-1',
        stockQty: 20,
      });

      const result = await service.checkStock('prod-1', 10);

      expect(result).toBe(true);
    });

    it('should return false when stock is insufficient', async () => {
      mockProductRepository.findById.mockResolvedValue({
        id: 'prod-1',
        stockQty: 5,
      });

      const result = await service.checkStock('prod-1', 10);

      expect(result).toBe(false);
    });

    it('should return false if product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      const result = await service.checkStock('nonexistent', 10);

      expect(result).toBe(false);
    });
  });
});
