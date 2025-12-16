import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  mockProcurementRepository,
  resetRepositoryMocks,
} from '../mocks/repositories.mock';

// Mock ProcurementRepository
vi.mock(
  '../../../src/modules/procurement/procurement.repository',
  () => ({
    ProcurementRepository: function () {
      return mockProcurementRepository;
    },
  })
);

// Import after mocking
import { ProcurementService } from '../../../src/modules/procurement/procurement.service';

describe('PurchaseOrderService (ProcurementService)', () => {
  let service: ProcurementService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetRepositoryMocks();
    service = new ProcurementService();
  });

  describe('create', () => {
    it('should create a new purchase order', async () => {
      const mockOrder = {
        id: 'order-1',
        companyId,
        orderNumber: 'PO-001',
        status: 'DRAFT',
        items: [],
      };

      mockProcurementRepository.count.mockResolvedValue(0);
      mockProcurementRepository.create.mockResolvedValue(mockOrder);

      const result = await service.create(companyId, {
        partnerId: 'partner-1',
        items: [{ productId: 'prod-1', quantity: 10, price: 100 }],
      });

      expect(result).toEqual(mockOrder);
    });
  });

  describe('getById', () => {
    it('should return a purchase order by ID', async () => {
      const mockOrder = {
        id: 'order-1',
        companyId,
        type: 'PURCHASE',
      };
      mockProcurementRepository.findById.mockResolvedValue(mockOrder);

      const result = await service.getById('order-1', companyId);

      expect(result).toEqual(mockOrder);
    });

    it('should return null for non-existent order', async () => {
      mockProcurementRepository.findById.mockResolvedValue(null);

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
      mockProcurementRepository.findAll.mockResolvedValue(mockOrders);

      const result = await service.list(companyId);

      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const mockOrders = [{ id: 'order-1', status: 'CONFIRMED' }];
      mockProcurementRepository.findAll.mockResolvedValue(mockOrders);

      const result = await service.list(
        companyId,
        'CONFIRMED' as any
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('confirm', () => {
    it('should confirm a draft purchase order', async () => {
      const mockOrder = { id: 'order-1', status: 'DRAFT' };
      const confirmedOrder = { ...mockOrder, status: 'CONFIRMED' };

      mockProcurementRepository.findById.mockResolvedValue(mockOrder);
      mockProcurementRepository.updateStatus.mockResolvedValue(
        confirmedOrder
      );

      const result = await service.confirm('order-1', companyId);

      expect(result.status).toBe('CONFIRMED');
    });

    it('should throw error if order not found', async () => {
      mockProcurementRepository.findById.mockResolvedValue(null);

      await expect(
        service.confirm('nonexistent', companyId)
      ).rejects.toThrow('Purchase order not found');
    });
  });

  describe('cancel', () => {
    it('should cancel a purchase order', async () => {
      const mockOrder = { id: 'order-1', status: 'DRAFT' };
      const cancelledOrder = { ...mockOrder, status: 'CANCELLED' };

      mockProcurementRepository.findById.mockResolvedValue(mockOrder);
      mockProcurementRepository.updateStatus.mockResolvedValue(
        cancelledOrder
      );

      const result = await service.cancel('order-1', companyId);

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw error if order is already completed', async () => {
      const mockOrder = { id: 'order-1', status: 'COMPLETED' };
      mockProcurementRepository.findById.mockResolvedValue(mockOrder);

      await expect(
        service.cancel('order-1', companyId)
      ).rejects.toThrow('Cannot cancel a completed order');
    });
  });

  describe('getItems', () => {
    it('should return items for a purchase order', async () => {
      const mockItems = [
        { id: 'item-1', productId: 'prod-1', quantity: 10 },
        { id: 'item-2', productId: 'prod-2', quantity: 5 },
      ];
      mockProcurementRepository.findItems.mockResolvedValue(
        mockItems
      );

      const result = await service.getItems('order-1');

      expect(result).toHaveLength(2);
    });
  });
});
