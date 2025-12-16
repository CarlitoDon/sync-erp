import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryService } from '../../../../src/modules/inventory/inventory.service';
import { prisma } from '@sync-erp/database';

// Mock dependencies
vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');
  return {
    ...actual,
    prisma: {
      order: { findFirst: vi.fn() },
      orderItem: { update: vi.fn() },
    },
  };
});
vi.mock('../../../../src/modules/inventory/inventory.repository');
vi.mock('../../../../src/modules/product/product.service');
vi.mock(
  '../../../../src/modules/accounting/services/journal.service'
);

describe('T019: Inventory Concurrency Guard', () => {
  let service: InventoryService;
  let mockProductService: any;
  let mockRepo: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InventoryService();
    mockProductService = (service as any).productService;
    mockRepo = (service as any).repository;
  });

  const companyId = 'co-1';
  const orderId = 'ord-1';

  it('should process shipment atomically', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: orderId,
      companyId,
      orderNumber: 'SO-1',
      items: [{ productId: 'p1', quantity: 5, id: 'i1' }],
    } as any);

    mockProductService.decreaseStock.mockResolvedValue({});
    mockProductService.getById.mockResolvedValue({
      id: 'p1',
      averageCost: 10,
    });
    mockRepo.createMovement.mockResolvedValue({});

    await service.processShipment(companyId, orderId);

    expect(mockProductService.decreaseStock).toHaveBeenCalledWith(
      'p1',
      5
    );
    expect(prisma.orderItem.update).toHaveBeenCalled();
  });

  it('should rollback if second item fails', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: orderId,
      companyId,
      orderNumber: 'SO-1',
      items: [
        { productId: 'p1', quantity: 5, id: 'i1' },
        { productId: 'p2', quantity: 10, id: 'i2' }, // This will fail
      ],
    } as any);

    mockProductService.getById.mockResolvedValue({
      id: 'p1',
      averageCost: 10,
    });
    mockRepo.createMovement.mockResolvedValue({});

    // Mock decreaseStock behavior
    mockProductService.decreaseStock
      .mockResolvedValueOnce({}) // P1 success
      .mockRejectedValueOnce(new Error('Insufficient stock')); // P2 fail

    await expect(
      service.processShipment(companyId, orderId)
    ).rejects.toThrow('Insufficient stock');

    // Verify Rollback calls
    expect(mockProductService.updateStock).toHaveBeenCalledWith(
      'p1',
      5
    ); // Re-increment P1
  });
});
