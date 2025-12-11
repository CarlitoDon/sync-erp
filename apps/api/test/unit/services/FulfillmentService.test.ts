import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

// Mock the database module
vi.mock('@sync-erp/database', () => ({
  prisma: mockPrisma,
  MovementType: {
    IN: 'IN',
    OUT: 'OUT',
    ADJUSTMENT: 'ADJUSTMENT',
  },
}));

// Mock dependent services
vi.mock('../../../src/services/SalesOrderService', () => ({
  SalesOrderService: vi.fn().mockImplementation(() => ({
    getById: vi.fn(),
    complete: vi.fn(),
  })),
}));

vi.mock('../../../src/services/InventoryService', () => ({
  InventoryService: vi.fn().mockImplementation(() => ({
    processShipment: vi.fn(),
  })),
}));

// Import after mocking
import { FulfillmentService } from '../../../src/services/FulfillmentService';
import { SalesOrderService } from '../../../src/services/SalesOrderService';
import { InventoryService } from '../../../src/services/InventoryService';

describe('FulfillmentService', () => {
  let service: FulfillmentService;
  let mockSalesOrderService: any;
  let mockInventoryService: any;
  const companyId = 'company-1';

  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
    service = new FulfillmentService();
    mockSalesOrderService = (SalesOrderService as any).mock.results[0]?.value || {};
    mockInventoryService = (InventoryService as any).mock.results[0]?.value || {};
  });

  describe('processShipment', () => {
    it('should process shipment for a confirmed order', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'SO-001',
        status: 'CONFIRMED',
        items: [{ productId: 'prod-1', quantity: 5 }],
      };
      const mockMovements = [{ id: 'mov-1', type: 'OUT', quantity: 5 }];

      // Setup mocks on the instance
      (service as any).salesOrderService.getById = vi.fn().mockResolvedValue(mockOrder);
      (service as any).inventoryService.processShipment = vi.fn().mockResolvedValue(mockMovements);
      (service as any).salesOrderService.complete = vi.fn().mockResolvedValue(mockOrder);

      const result = await service.processShipment(companyId, { orderId: 'order-1' });

      expect(result).toEqual(mockMovements);
      expect((service as any).salesOrderService.complete).toHaveBeenCalledWith(
        'order-1',
        companyId
      );
    });

    it('should throw error if order not found', async () => {
      (service as any).salesOrderService.getById = vi.fn().mockResolvedValue(null);

      await expect(service.processShipment(companyId, { orderId: 'nonexistent' })).rejects.toThrow(
        'Sales order not found'
      );
    });

    it('should throw error if order is not confirmed', async () => {
      const mockOrder = { id: 'order-1', status: 'DRAFT' };
      (service as any).salesOrderService.getById = vi.fn().mockResolvedValue(mockOrder);

      await expect(service.processShipment(companyId, { orderId: 'order-1' })).rejects.toThrow(
        'Order must be confirmed before shipping'
      );
    });
  });

  describe('getDeliveryHistory', () => {
    it('should return delivery history for an order', async () => {
      const mockMovements = [
        { id: 'mov-1', type: 'OUT', quantity: 5 },
        { id: 'mov-2', type: 'OUT', quantity: 3 },
      ];

      // Add inventoryMovement to mock
      (mockPrisma as any).inventoryMovement = {
        findMany: vi.fn().mockResolvedValue(mockMovements),
      };

      const result = await service.getDeliveryHistory('order-1');

      expect(result).toHaveLength(2);
    });
  });
});
