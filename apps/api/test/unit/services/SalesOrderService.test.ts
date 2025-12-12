import { vi } from 'vitest';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

// Mock the database module

// Mock dependent services
vi.mock('../../../src/services/ProductService', () => ({
  ProductService: vi.fn().mockImplementation(() => ({
    checkStock: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('../../../src/services/InventoryService', () => ({
  InventoryService: vi.fn().mockImplementation(() => ({
    processReturn: vi.fn().mockResolvedValue([]),
  })),
}));

// Add orderItem to mock
(mockPrisma as any).orderItem = {
  findMany: vi.fn(),
};

// Import after mocking
import { SalesOrderService } from '../../../src/services/SalesOrderService';

describe('SalesOrderService', () => {
  let service: SalesOrderService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
    service = new SalesOrderService();
  });

  describe('create', () => {
    it('should create a sales order', async () => {
      const mockOrder = {
        id: 'order-1',
        companyId,
        type: 'SALES',
        status: 'DRAFT',
        orderNumber: 'SO-00001',
        totalAmount: 1000,
      };

      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.create.mockResolvedValue(mockOrder);

      const result = await service.create(companyId, 'user-1', {
        partnerId: 'partner-1',
        items: [{ productId: 'prod-1', quantity: 10, price: 100 }],
      });

      expect(result).toEqual(mockOrder);
      expect(result.orderNumber).toBe('SO-00001');
    });
  });

  describe('getById', () => {
    it('should return a sales order by ID', async () => {
      const mockOrder = { id: 'order-1', companyId, type: 'SALES' };
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.getById('order-1', companyId);

      expect(result).toEqual(mockOrder);
    });

    it('should return null for non-existent order', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

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
      mockPrisma.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.list(companyId);

      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const mockOrders = [{ id: 'order-1', status: 'CONFIRMED' }];
      mockPrisma.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.list(companyId, 'CONFIRMED');

      expect(result).toHaveLength(1);
    });
  });

  describe('confirm', () => {
    it('should confirm a draft order', async () => {
      const mockOrder = { id: 'order-1', companyId, status: 'DRAFT' };
      const confirmedOrder = { ...mockOrder, status: 'CONFIRMED' };
      const mockItems = [
        {
          productId: 'prod-1',
          quantity: 5,
          product: { name: 'Product 1' },
        },
      ];

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      (mockPrisma as any).orderItem.findMany.mockResolvedValue(
        mockItems
      );
      mockPrisma.order.update.mockResolvedValue(confirmedOrder);

      const result = await service.confirm('order-1', companyId);

      expect(result.status).toBe('CONFIRMED');
    });

    it('should throw error if order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.confirm('nonexistent', companyId)
      ).rejects.toThrow('Sales order not found');
    });

    it('should throw error if order is not draft', async () => {
      const mockOrder = { id: 'order-1', status: 'COMPLETED' };
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      await expect(
        service.confirm('order-1', companyId)
      ).rejects.toThrow(
        'Cannot confirm order with status: COMPLETED'
      );
    });

    it('should throw error if insufficient stock', async () => {
      const mockOrder = { id: 'order-1', status: 'DRAFT' };
      const mockItems = [
        {
          productId: 'prod-1',
          quantity: 100,
          product: { name: 'Product 1' },
        },
      ];

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      (mockPrisma as any).orderItem.findMany.mockResolvedValue(
        mockItems
      );
      (service as any).productService.checkStock = vi
        .fn()
        .mockResolvedValue(false);

      await expect(
        service.confirm('order-1', companyId)
      ).rejects.toThrow('Insufficient stock');
    });
  });

  describe('complete', () => {
    it('should complete a confirmed order', async () => {
      const mockOrder = {
        id: 'order-1',
        companyId,
        status: 'CONFIRMED',
      };
      const completedOrder = { ...mockOrder, status: 'COMPLETED' };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.order.update.mockResolvedValue(completedOrder);

      const result = await service.complete('order-1', companyId);

      expect(result.status).toBe('COMPLETED');
    });

    it('should throw error if order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.complete('nonexistent', companyId)
      ).rejects.toThrow('Sales order not found');
    });

    it('should throw error if order is not confirmed', async () => {
      const mockOrder = { id: 'order-1', status: 'DRAFT' };
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      await expect(
        service.complete('order-1', companyId)
      ).rejects.toThrow('Cannot complete order with status: DRAFT');
    });
  });

  describe('cancel', () => {
    it('should cancel an order', async () => {
      const mockOrder = { id: 'order-1', companyId, status: 'DRAFT' };
      const cancelledOrder = { ...mockOrder, status: 'CANCELLED' };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.order.update.mockResolvedValue(cancelledOrder);

      const result = await service.cancel('order-1', companyId);

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw error if order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.cancel('nonexistent', companyId)
      ).rejects.toThrow('Sales order not found');
    });

    it('should throw error if order is completed', async () => {
      const mockOrder = { id: 'order-1', status: 'COMPLETED' };
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      await expect(
        service.cancel('order-1', companyId)
      ).rejects.toThrow('Cannot cancel a completed order');
    });
  });

  describe('getItems', () => {
    it('should return order items', async () => {
      const mockItems = [
        { id: 'item-1', productId: 'prod-1', quantity: 5 },
        { id: 'item-2', productId: 'prod-2', quantity: 10 },
      ];

      (mockPrisma as any).orderItem.findMany.mockResolvedValue(
        mockItems
      );

      const result = await service.getItems('order-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('returnOrder', () => {
    it('should process a return for an order', async () => {
      const mockOrder = {
        id: 'order-1',
        companyId,
        status: 'COMPLETED',
      };
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      await service.returnOrder(companyId, 'order-1', [
        { productId: 'prod-1', quantity: 2 },
      ]);

      expect(
        (service as any).inventoryService.processReturn
      ).toHaveBeenCalled();
    });

    it('should throw error if order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.returnOrder(companyId, 'nonexistent', [
          { productId: 'prod-1', quantity: 1 },
        ])
      ).rejects.toThrow('Sales order not found');
    });
  });
});
