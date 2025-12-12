import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  mockSalesRepository,
  resetRepositoryMocks,
} from '../mocks/repositories.mock';

// Mock ProductService
const mockProductService = {
  checkStock: vi.fn().mockResolvedValue(true),
};
vi.mock('../../../src/modules/product/product.service', () => ({
  ProductService: vi
    .fn()
    .mockImplementation(() => mockProductService),
}));

// Mock InventoryService
const mockInventoryService = {
  processShipment: vi.fn().mockResolvedValue([]),
};
vi.mock('../../../src/modules/inventory/inventory.service', () => ({
  InventoryService: vi
    .fn()
    .mockImplementation(() => mockInventoryService),
}));

// Mock DocumentNumberService
const mockDocumentNumberService = {
  generate: vi.fn().mockResolvedValue('SO-00001'),
};
vi.mock(
  '../../../src/modules/common/services/document-number.service',
  () => ({
    DocumentNumberService: vi
      .fn()
      .mockImplementation(() => mockDocumentNumberService),
  })
);

// Mock SalesRepository
vi.mock('../../../src/modules/sales/sales.repository', () => ({
  SalesRepository: vi
    .fn()
    .mockImplementation(() => mockSalesRepository),
}));

// Import after mocking
import { SalesService } from '../../../src/modules/sales/sales.service';

describe('SalesOrderService (SalesService)', () => {
  let service: SalesService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetRepositoryMocks();
    vi.clearAllMocks();
    service = new SalesService();
  });

  describe('create', () => {
    it('should create a new sales order', async () => {
      const mockOrder = {
        id: 'order-1',
        companyId,
        orderNumber: 'SO-001',
        status: 'DRAFT',
        items: [],
      };

      mockSalesRepository.count.mockResolvedValue(0);
      mockSalesRepository.create.mockResolvedValue(mockOrder);

      const result = await service.create(companyId, {
        partnerId: 'partner-1',
        items: [{ productId: 'prod-1', quantity: 10, price: 100 }],
      });

      expect(result).toEqual(mockOrder);
    });
  });

  describe('getById', () => {
    it('should return a sales order by ID', async () => {
      const mockOrder = { id: 'order-1', companyId, type: 'SALES' };
      mockSalesRepository.findById.mockResolvedValue(mockOrder);

      const result = await service.getById('order-1', companyId);

      expect(result).toEqual(mockOrder);
    });

    it('should return null for non-existent order', async () => {
      mockSalesRepository.findById.mockResolvedValue(null);

      const result = await service.getById('nonexistent', companyId);

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all sales orders', async () => {
      const mockOrders = [
        { id: 'order-1', type: 'SALES' },
        { id: 'order-2', type: 'SALES' },
      ];
      mockSalesRepository.findAll.mockResolvedValue(mockOrders);

      const result = await service.list(companyId);

      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const mockOrders = [{ id: 'order-1', status: 'CONFIRMED' }];
      mockSalesRepository.findAll.mockResolvedValue(mockOrders);

      const result = await service.list(companyId, 'CONFIRMED');

      expect(result).toHaveLength(1);
    });
  });

  describe('confirm', () => {
    it('should confirm a draft sales order', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'DRAFT',
        items: [
          {
            productId: 'prod-1',
            quantity: 5,
            product: { name: 'Product 1' },
          },
        ],
      };
      const confirmedOrder = { ...mockOrder, status: 'CONFIRMED' };

      mockSalesRepository.findById.mockResolvedValue(mockOrder);
      mockProductService.checkStock.mockResolvedValue(true);
      mockSalesRepository.updateStatus.mockResolvedValue(
        confirmedOrder
      );

      const result = await service.confirm('order-1', companyId);

      expect(result.status).toBe('CONFIRMED');
    });

    it('should throw error if order not found', async () => {
      mockSalesRepository.findById.mockResolvedValue(null);

      await expect(
        service.confirm('nonexistent', companyId)
      ).rejects.toThrow('Sales order not found');
    });

    it('should throw error if insufficient stock', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'DRAFT',
        items: [
          {
            productId: 'prod-1',
            quantity: 100,
            product: { name: 'Product 1' },
          },
        ],
      };

      mockSalesRepository.findById.mockResolvedValue(mockOrder);
      mockProductService.checkStock.mockResolvedValue(false);

      await expect(
        service.confirm('order-1', companyId)
      ).rejects.toThrow('Insufficient stock');
    });
  });

  describe('cancel', () => {
    it('should cancel a sales order', async () => {
      const mockOrder = { id: 'order-1', status: 'DRAFT' };
      const cancelledOrder = { ...mockOrder, status: 'CANCELLED' };

      mockSalesRepository.findById.mockResolvedValue(mockOrder);
      mockSalesRepository.updateStatus.mockResolvedValue(
        cancelledOrder
      );

      const result = await service.cancel('order-1', companyId);

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw error if order is already completed', async () => {
      const mockOrder = { id: 'order-1', status: 'COMPLETED' };
      mockSalesRepository.findById.mockResolvedValue(mockOrder);

      await expect(
        service.cancel('order-1', companyId)
      ).rejects.toThrow('Cannot cancel a completed order');
    });
  });

  describe('ship', () => {
    it('should ship a confirmed order', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'CONFIRMED',
        orderNumber: 'SO-001',
      };
      const mockMovements = [
        { id: 'mov-1', type: 'OUT', quantity: 5 },
      ];

      mockSalesRepository.findById.mockResolvedValue(mockOrder);
      mockInventoryService.processShipment.mockResolvedValue(
        mockMovements
      );
      mockSalesRepository.updateStatus.mockResolvedValue({
        ...mockOrder,
        status: 'COMPLETED',
      });

      const result = await service.ship(companyId, 'order-1');

      expect(result).toEqual(mockMovements);
    });

    it('should throw error if order not confirmed', async () => {
      const mockOrder = { id: 'order-1', status: 'DRAFT' };
      mockSalesRepository.findById.mockResolvedValue(mockOrder);

      await expect(
        service.ship(companyId, 'order-1')
      ).rejects.toThrow('Order must be confirmed before shipping');
    });
  });
});
