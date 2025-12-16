import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryService } from '../../../../src/modules/inventory/inventory.service';
import { prisma } from '@sync-erp/database';

// Automock prisma
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

describe('T017: Stock Return (Cost Accuracy)', () => {
  let service: InventoryService;
  let mockProductService: any;
  let mockJournal: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InventoryService();
    mockProductService = (service as any).productService;
    mockJournal = (service as any).journalService;
  });

  const companyId = 'co-1';
  const orderId = 'ord-1';
  const productId = 'prod-1';

  it('should save cost during shipment', async () => {
    // Setup Order
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: orderId,
      companyId,
      orderNumber: 'SO-1',
      items: [{ id: 'item-1', productId, quantity: 1, price: 100 }],
    } as any);

    // Setup Product Cost = 50
    mockProductService.checkStock.mockResolvedValue(true);
    mockProductService.getById.mockResolvedValue({
      id: productId,
      averageCost: 50,
    });

    await service.processShipment(companyId, orderId);

    // Verify Cost Snapshot
    expect(prisma.orderItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { cost: 50 },
    });
  });

  it('should use snapshot cost for return', async () => {
    // Setup Order with Snapshot Cost = 50
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: orderId,
      companyId,
      orderNumber: 'SO-1',
      items: [
        {
          id: 'item-1',
          productId,
          quantity: 1,
          price: 100,
          cost: 50,
        },
      ],
    } as any);

    // Current Product Cost = 80 (Changed)
    mockProductService.getById.mockResolvedValue({
      id: productId,
      averageCost: 80,
    });

    await service.processReturn(companyId, orderId, [
      { productId, quantity: 1 },
    ]);

    // Verify Journal posted with 50 (Snapshot) not 80 (Current)
    expect(mockJournal.postSalesReturn).toHaveBeenCalledWith(
      companyId,
      expect.stringContaining('SO-1'),
      50 // Cost Reversal
    );
  });

  it('should fallback to current cost if snapshot is missing', async () => {
    // Setup Order WITHOUT Snapshot Cost
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: orderId,
      companyId,
      orderNumber: 'SO-1',
      items: [
        {
          id: 'item-1',
          productId,
          quantity: 1,
          price: 100,
          cost: null,
        },
      ],
    } as any);

    // Current Product Cost = 80
    mockProductService.getById.mockResolvedValue({
      id: productId,
      averageCost: 80,
    });

    await service.processReturn(companyId, orderId, [
      { productId, quantity: 1 },
    ]);

    // Verify Journal posted with 80 (Fallback)
    expect(mockJournal.postSalesReturn).toHaveBeenCalledWith(
      companyId,
      expect.stringContaining('SO-1'),
      80
    );
  });
});
