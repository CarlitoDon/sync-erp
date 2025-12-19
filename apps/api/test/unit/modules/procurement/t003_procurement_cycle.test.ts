import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';
import {
  BusinessShape,
  OrderStatus,
  OrderType,
} from '@sync-erp/database';

// Automock
vi.mock('@modules/procurement/purchase-order.repository');
vi.mock('@modules/common/services/document-number.service');

// Mock Prisma
vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');
  return {
    ...actual,
    prisma: {
      order: {
        findFirst: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    },
  };
});

describe('T003: Verify Purchase Order Cycle (FR-009)', () => {
  let service: PurchaseOrderService;
  let mockRepo: any;
  let mockDocService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PurchaseOrderService();
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

      await service.confirm(orderId, companyId, 'test-user-id');

      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        orderId,
        OrderStatus.CONFIRMED,
        undefined // order.version is undefined in mock
      );
    });

    it('should fail if order not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(
        service.confirm(orderId, companyId, 'test-user-id')
      ).rejects.toThrow();
    });

    it('should fail if status is NOT DRAFT', async () => {
      mockRepo.findById.mockResolvedValue({
        id: orderId,
        status: OrderStatus.CONFIRMED,
      });
      await expect(
        service.confirm(orderId, companyId, 'test-user-id')
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
        OrderStatus.COMPLETED,
        undefined,
        undefined
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
