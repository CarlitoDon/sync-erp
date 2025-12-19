import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryService } from '@modules/inventory/inventory.service';

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

vi.mock('@modules/inventory/inventory.repository');
vi.mock('@modules/product/product.service');
vi.mock('@modules/accounting/services/journal.service');

describe('T017: Stock Return (Cost Accuracy)', () => {
  let service: InventoryService;
  let mockProductService: any;
  let mockJournal: any;
  let mockRepo: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InventoryService();
    mockProductService = (service as any).productService;
    mockJournal = (service as any).journalService;
    mockRepo = (service as any).repository;
  });

  const companyId = 'co-1';
  const orderId = 'ord-1';
  const productId = 'prod-1';

  it('should save cost during shipment', async () => {
    // Mock repository.findOrderWithItems (used by InventoryService.processShipment)
    mockRepo.findOrderWithItems.mockResolvedValue({
      id: orderId,
      companyId,
      orderNumber: 'SO-1',
      items: [{ id: 'item-1', productId, quantity: 1, price: 100 }],
    } as any);

    // Setup Product Cost = 50
    mockProductService.checkStock.mockResolvedValue(true);
    mockProductService.getById.mockResolvedValue({
      id: productId,
      name: 'Product 1',
      stockQty: 100,
      averageCost: 50,
    });
    mockProductService.decreaseStock.mockResolvedValue({});

    await service.processShipment(companyId, orderId);

    // Verify Cost Snapshot
    expect(mockRepo.updateOrderItemCost).toHaveBeenCalledWith(
      'item-1',
      50,
      undefined
    );
  });

  it('should use snapshot cost for return', async () => {
    // Mock repository.findOrderWithItems (used by InventoryService.processReturn)
    mockRepo.findOrderWithItems.mockResolvedValue({
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
      50, // Cost Reversal
      undefined
    );
  });

  it('should fallback to current cost if snapshot is missing', async () => {
    // Mock repository.findOrderWithItems
    mockRepo.findOrderWithItems.mockResolvedValue({
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
      80,
      undefined
    );
  });
});
