import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryService } from '../../../../src/modules/inventory/inventory.service';
import { BusinessShape, prisma } from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

// Automock dependencies
vi.mock('../../../../src/modules/inventory/inventory.repository');
vi.mock('../../../../src/modules/product/product.service');
vi.mock('../../../../src/modules/procurement/procurement.service');

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

describe('T002: Enforce Rules & Policies (FR-005)', () => {
  let service: InventoryService;
  let mockProductService: any;
  let mockRepo: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InventoryService();
    mockProductService = (service as any).productService;
    mockRepo = (service as any).repository;
  });

  describe('processShipment', () => {
    const companyId = 'co-1';
    const orderId = 'so-1';
    const shape = BusinessShape.RETAIL;

    it('shoud throw DomainError if stock is insufficient (Negative Stock Prevention)', async () => {
      // Mock order found
      vi.mocked(prisma.order.findFirst).mockResolvedValue({
        id: orderId,
        companyId,
        orderNumber: 'SO-001',
        items: [{ productId: 'prod-A', quantity: 10 }],
      } as any);

      // Mock ProductService.checkStock returning FALSE (Insufficient)
      mockProductService.checkStock.mockResolvedValue(false);

      await expect(
        service.processShipment(companyId, orderId, undefined, shape)
      ).rejects.toThrowError(DomainError);

      // Verify Error Code
      await expect(
        service.processShipment(companyId, orderId, undefined, shape)
      ).rejects.toHaveProperty(
        'code',
        DomainErrorCodes.INSUFFICIENT_STOCK
      );
    });

    it('should throw DomainError if shape is SERVICE (Policy Block)', async () => {
      // Mock order found
      // Actually Policy check happens BEFORE order lookup in new logic?
      // Let's check logic: "if (shape) InventoryPolicy.ensureCanAdjustStock(shape)"
      // So mocks might not be needed if it fails early.

      const serviceShape = BusinessShape.SERVICE;

      await expect(
        service.processShipment(
          companyId,
          orderId,
          undefined,
          serviceShape
        )
      ).rejects.toThrowError(DomainError);

      // Verify no DB calls
      expect(prisma.order.findFirst).not.toHaveBeenCalled();
    });

    it('should throw DomainError if inventory disabled by config', async () => {
      const configs = [
        { key: 'inventory.enabled', value: false as any },
      ];

      await expect(
        service.processShipment(
          companyId,
          orderId,
          undefined,
          shape,
          configs
        )
      ).rejects.toThrowError(DomainError);

      expect(prisma.order.findFirst).not.toHaveBeenCalled();
    });
  });
});
