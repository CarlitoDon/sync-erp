import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcurementService } from '../../../../src/modules/procurement/procurement.service';
import {
  BusinessShape,
  OrderStatus,
  OrderType,
} from '@sync-erp/database';

// Automock
vi.mock('../../../../src/modules/procurement/procurement.repository');
vi.mock(
  '../../../../src/modules/common/services/document-number.service'
);

// Mock Prisma
vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');
  return {
    ...actual,
    prisma: {
      order: {
        findFirst: vi.fn(),
      },
    },
  };
});

describe('T003: Verify Purchase Order Cycle (FR-009)', () => {
  let service: ProcurementService;
  let mockRepo: any;
  let mockDocService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProcurementService();
    mockRepo = (service as any).repository;
    mockDocService = (service as any).documentNumberService;
  });

  const companyId = 'co-1';
  const orderId = 'po-1';

  describe('create', () => {
    it('should create DRAFT Purchase Order', async () => {
      mockDocService.generate.mockResolvedValue('PO-001');

      const input = {
        partnerId: 'partner-1',
        items: [{ productId: 'prod-A', quantity: 10, price: 100 }],
      };

      await service.create(companyId, input, BusinessShape.RETAIL);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: OrderType.PURCHASE,
          status: OrderStatus.DRAFT,
          orderNumber: 'PO-001',
        })
      );
    });
  });

  describe('confirm', () => {
    it('should transition DRAFT to CONFIRMED', async () => {
      // Mock finding order
      mockRepo.findById.mockResolvedValue({
        id: orderId,
        status: OrderStatus.DRAFT,
      });

      await service.confirm(orderId, companyId);

      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        orderId,
        OrderStatus.CONFIRMED
      );
    });

    it('should fail if order not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(
        service.confirm(orderId, companyId)
      ).rejects.toThrow();
    });

    it('should fail if status is NOT DRAFT', async () => {
      mockRepo.findById.mockResolvedValue({
        id: orderId,
        status: OrderStatus.CONFIRMED,
      });
      await expect(
        service.confirm(orderId, companyId)
      ).rejects.toThrow();
    });
  });

  describe('complete', () => {
    it('should transition CONFIRMED to COMPLETED', async () => {
      mockRepo.findById.mockResolvedValue({
        id: orderId,
        status: OrderStatus.CONFIRMED,
      });

      await service.complete(orderId, companyId);

      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        orderId,
        OrderStatus.COMPLETED
      );
    });

    it('should fail if status is NOT CONFIRMED', async () => {
      mockRepo.findById.mockResolvedValue({
        id: orderId,
        status: OrderStatus.DRAFT,
      });
      await expect(
        service.complete(orderId, companyId)
      ).rejects.toThrow();
    });
  });
});
