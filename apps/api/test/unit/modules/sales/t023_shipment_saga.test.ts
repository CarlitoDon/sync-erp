import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  prisma,
  SagaType,
  SagaStep,
  OrderStatus,
} from '@sync-erp/database';
import { ShipmentSaga } from '@modules/sales/sagas/shipment.saga';
import { SagaCompensatedError } from '@modules/common/saga/saga-errors';

// Mock all dependencies using vi.hoisted() to avoid initialization order issues
const {
  mockSagaLog,
  mockOrder,
  mockOrderItem,
  mockProduct,
  mockInventoryMovement,
  mockAccount,
  mockJournalEntry,
  mockShipment,
  mockShipmentItem,
} = vi.hoisted(() => ({
  mockSagaLog: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  mockOrder: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  mockOrderItem: {
    update: vi.fn(),
  },
  mockProduct: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  mockInventoryMovement: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  mockAccount: {
    findFirst: vi.fn(),
  },
  mockJournalEntry: {
    create: vi.fn(),
  },
  mockShipment: {
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  mockShipmentItem: {
    createMany: vi.fn(),
  },
}));

vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');
  return {
    ...actual,
    prisma: {
      sagaLog: mockSagaLog,
      order: mockOrder,
      orderItem: mockOrderItem,
      product: mockProduct,
      inventoryMovement: mockInventoryMovement,
      account: mockAccount,
      journalEntry: mockJournalEntry,
      shipment: mockShipment,
      shipmentItem: mockShipmentItem,
      $transaction: vi
        .fn()
        .mockImplementation(
          async (callback: (tx: any) => Promise<any>) => {
            // The mockTx must include all models that ShipmentSaga uses
            const mockTx = {
              $executeRawUnsafe: vi.fn().mockResolvedValue(1),
              order: mockOrder,
              orderItem: mockOrderItem,
              product: mockProduct,
              inventoryMovement: mockInventoryMovement,
              account: mockAccount,
              journalEntry: mockJournalEntry,
              shipment: mockShipment,
              shipmentItem: mockShipmentItem,
            };
            return callback(mockTx);
          }
        ),
    },
  };
});

// Mock InventoryService to avoid deep database interactions
const { mockInventoryService } = vi.hoisted(() => ({
  mockInventoryService: {
    createShipment: vi.fn().mockResolvedValue({
      id: 'shipment-1',
      shipmentNumber: 'SHP-001',
      status: 'DRAFT',
    }),
    postShipment: vi.fn().mockResolvedValue({
      id: 'shipment-1',
      status: 'POSTED',
    }),
  },
}));
vi.mock('@modules/inventory/inventory.service', () => ({
  InventoryService: function () {
    return mockInventoryService;
  },
}));

// Mock ProductService for stock checking
const { mockProductService } = vi.hoisted(() => ({
  mockProductService: {
    checkStock: vi.fn().mockResolvedValue(true),
    getById: vi
      .fn()
      .mockResolvedValue({ stockQty: 100, averageCost: 50 }),
    decreaseStock: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock('@modules/product/product.service', () => ({
  ProductService: function () {
    return mockProductService;
  },
}));

describe('T023: Shipment Saga', () => {
  let saga: ShipmentSaga;

  // Renamed to mockOrderData to avoid collision with hoisted prisma mockOrder
  const mockOrderData = {
    id: 'order-1',
    companyId: 'co-1',
    orderNumber: 'SO-001',
    status: OrderStatus.CONFIRMED,
    items: [
      { id: 'item-1', productId: 'prod-1', quantity: 5, price: 100 },
    ],
  };

  const mockSagaLog = {
    id: 'saga-1',
    sagaType: SagaType.SHIPMENT,
    entityId: 'order-1',
    companyId: 'co-1',
    step: SagaStep.PENDING,
    stepData: {},
    error: null,
    correlationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    saga = new ShipmentSaga();

    // Default saga log mock
    vi.mocked(prisma.sagaLog.create).mockResolvedValue(mockSagaLog);
    vi.mocked(prisma.sagaLog.update).mockResolvedValue({} as any);
  });

  describe('Successful Execution', () => {
    it('should ship order with stock movements', async () => {
      // Mock order lookup
      vi.mocked(prisma.order.findFirst).mockResolvedValue(
        mockOrderData as any
      );
      vi.mocked(prisma.order.update).mockResolvedValue({
        ...mockOrderData,
        status: OrderStatus.COMPLETED,
      } as any);

      // Mock product for stock check and shipment
      const mockProduct = {
        id: 'prod-1',
        stockQty: 100,
        averageCost: 50,
        isService: false,
      };
      vi.mocked(prisma.product.findUnique).mockResolvedValue(
        mockProduct as any
      );
      vi.mocked(prisma.product.findFirst).mockResolvedValue(
        mockProduct as any
      );
      vi.mocked(prisma.product.update).mockResolvedValue({} as any);
      vi.mocked(prisma.orderItem.update).mockResolvedValue({} as any);

      // Mock inventory movement
      vi.mocked(prisma.inventoryMovement.create).mockResolvedValue({
        id: 'mov-1',
      } as any);
      vi.mocked(prisma.inventoryMovement.findMany).mockResolvedValue(
        []
      );

      // Mock journal
      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: 'acc-1',
      } as any);
      vi.mocked(prisma.journalEntry.create).mockResolvedValue({
        id: 'jnl-1',
      } as any);

      const result = await saga.execute(
        { orderId: 'order-1', companyId: 'co-1' },
        'order-1',
        'co-1'
      );

      expect(result.success).toBe(true);
      expect(result.data?.movements).toBeDefined();
      expect(result.sagaLogId).toBe('saga-1');
    });
  });

  describe('Validation', () => {
    it('should fail on non-existent order', async () => {
      vi.mocked(prisma.order.findFirst).mockResolvedValue(null);

      await expect(
        saga.execute(
          { orderId: 'order-999', companyId: 'co-1' },
          'order-999',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });

    it('should fail on non-CONFIRMED order', async () => {
      vi.mocked(prisma.order.findFirst).mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.DRAFT,
      } as any);

      await expect(
        saga.execute(
          { orderId: 'order-1', companyId: 'co-1' },
          'order-1',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });

    it('should fail on insufficient stock', async () => {
      // Use mockOrder (the prisma mock) to set up the order data
      // The test's local mockOrder variable contains the test data
      const testOrderData = {
        id: 'order-1',
        companyId: 'co-1',
        orderNumber: 'SO-001',
        status: OrderStatus.CONFIRMED,
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            quantity: 5,
            price: 100,
          },
        ],
      };
      mockOrder.findFirst.mockResolvedValue(testOrderData as any);
      mockOrder.update.mockResolvedValue({} as any);

      // Make ProductService.checkStock fail (insufficient stock)
      mockProductService.checkStock.mockResolvedValue(false);

      await expect(
        saga.execute(
          { orderId: 'order-1', companyId: 'co-1' },
          'order-1',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });
  });

  describe('Compensation', () => {
    it('should revert order status on failure', async () => {
      vi.mocked(prisma.order.findFirst).mockResolvedValue(
        mockOrderData as any
      );
      vi.mocked(prisma.order.update).mockResolvedValue({} as any);

      // Product fails during shipment
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        stockQty: 100,
        averageCost: 50,
        isService: false,
      } as any);
      vi.mocked(prisma.product.update).mockRejectedValue(
        new Error('DB connection failed')
      );

      try {
        await saga.execute(
          { orderId: 'order-1', companyId: 'co-1' },
          'order-1',
          'co-1'
        );
      } catch {
        // Expected
      }

      // Verify compensation was attempted (order status update called for revert)
      expect(prisma.order.update).toHaveBeenCalled();
    });
  });
});
