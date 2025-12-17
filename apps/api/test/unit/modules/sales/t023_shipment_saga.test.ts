import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  prisma,
  SagaType,
  SagaStep,
  OrderStatus,
} from '@sync-erp/database';
import { ShipmentSaga } from '../../../../src/modules/sales/sagas/shipment.saga';
import { SagaCompensatedError } from '../../../../src/modules/common/saga/saga-errors';

// Mock all dependencies
vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');
  return {
    ...actual,
    prisma: {
      sagaLog: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      order: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      orderItem: {
        update: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      inventoryMovement: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      account: {
        findFirst: vi.fn(),
      },
      journalEntry: {
        create: vi.fn(),
      },
      $transaction: vi
        .fn()
        .mockImplementation(
          async (callback: (tx: any) => Promise<any>) => {
            const mockTx = {
              $executeRawUnsafe: vi.fn().mockResolvedValue(1),
            };
            return callback(mockTx);
          }
        ),
    },
  };
});

describe('T023: Shipment Saga', () => {
  let saga: ShipmentSaga;

  const mockOrder = {
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
        mockOrder as any
      );
      vi.mocked(prisma.order.update).mockResolvedValue({
        ...mockOrder,
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
      vi.mocked(prisma.order.findFirst).mockResolvedValue(
        mockOrder as any
      );
      vi.mocked(prisma.order.update).mockResolvedValue({} as any);

      // Mock product with insufficient stock
      // checkStock uses findUnique and compares stockQty >= quantity
      const insufficientProduct = {
        id: 'prod-1',
        stockQty: 2, // Less than required 5
        averageCost: 50,
        isService: false,
      };
      vi.mocked(prisma.product.findUnique).mockResolvedValue(
        insufficientProduct as any
      );
      vi.mocked(prisma.product.findFirst).mockResolvedValue(
        insufficientProduct as any
      );

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
        mockOrder as any
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
