import { vi } from 'vitest';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

// Mock the database module

// Add orderItem to mock if not exists
(mockPrisma as any).orderItem = {
  findMany: vi.fn(),
};

// Import after mocking
import { PurchaseOrderService } from '../../../src/services/PurchaseOrderService';

describe('PurchaseOrderService', () => {
  let service: PurchaseOrderService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
    service = new PurchaseOrderService();
  });

  describe('create', () => {
    it('should create a purchase order', async () => {
      const mockOrder = {
        id: 'order-1',
        companyId,
        type: 'PURCHASE',
        status: 'DRAFT',
        orderNumber: 'PO-00001',
        totalAmount: 500,
      };

      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.create.mockResolvedValue(mockOrder);

      const result = await service.create(companyId, 'user-1', {
        partnerId: 'partner-1',
        items: [{ productId: 'prod-1', quantity: 5, price: 100 }],
      });

      expect(result).toEqual(mockOrder);
      expect(result.orderNumber).toBe('PO-00001');
    });
  });

  describe('getById', () => {
    it('should return a purchase order by ID', async () => {
      const mockOrder = { id: 'order-1', companyId, type: 'PURCHASE' };
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
    it('should list all purchase orders', async () => {
      const mockOrders = [
        { id: 'order-1', type: 'PURCHASE' },
        { id: 'order-2', type: 'PURCHASE' },
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

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.order.update.mockResolvedValue(confirmedOrder);

      const result = await service.confirm('order-1', companyId);

      expect(result.status).toBe('CONFIRMED');
    });

    it('should throw error if order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(service.confirm('nonexistent', companyId)).rejects.toThrow(
        'Purchase order not found'
      );
    });

    it('should throw error if order is not draft', async () => {
      const mockOrder = { id: 'order-1', status: 'COMPLETED' };
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      await expect(service.confirm('order-1', companyId)).rejects.toThrow(
        'Cannot confirm order with status: COMPLETED'
      );
    });
  });

  describe('complete', () => {
    it('should complete a confirmed order', async () => {
      const mockOrder = { id: 'order-1', companyId, status: 'CONFIRMED' };
      const completedOrder = { ...mockOrder, status: 'COMPLETED' };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.order.update.mockResolvedValue(completedOrder);

      const result = await service.complete('order-1', companyId);

      expect(result.status).toBe('COMPLETED');
    });

    it('should throw error if order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(service.complete('nonexistent', companyId)).rejects.toThrow(
        'Purchase order not found'
      );
    });

    it('should throw error if order is not confirmed', async () => {
      const mockOrder = { id: 'order-1', status: 'DRAFT' };
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      await expect(service.complete('order-1', companyId)).rejects.toThrow(
        'Cannot complete order with status: DRAFT'
      );
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

      await expect(service.cancel('nonexistent', companyId)).rejects.toThrow(
        'Purchase order not found'
      );
    });

    it('should throw error if order is completed', async () => {
      const mockOrder = { id: 'order-1', status: 'COMPLETED' };
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      await expect(service.cancel('order-1', companyId)).rejects.toThrow(
        'Cannot cancel a completed order'
      );
    });
  });

  describe('getItems', () => {
    it('should return order items', async () => {
      const mockItems = [
        { id: 'item-1', productId: 'prod-1', quantity: 5 },
        { id: 'item-2', productId: 'prod-2', quantity: 10 },
      ];

      (mockPrisma as any).orderItem.findMany.mockResolvedValue(mockItems);

      const result = await service.getItems('order-1');

      expect(result).toHaveLength(2);
    });
  });
});
