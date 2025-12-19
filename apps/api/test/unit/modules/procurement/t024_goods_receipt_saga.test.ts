import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  prisma,
  SagaType,
  SagaStep,
  OrderStatus,
} from '@sync-erp/database';
import { GoodsReceiptSaga } from '@modules/procurement/sagas/goods-receipt.saga';
import { SagaCompensatedError } from '@modules/common/saga/saga-errors';

// Mock all dependencies using vi.hoisted() to avoid initialization order issues
// vi.mock is hoisted to the top of the file, so we need vi.hoisted() for variables used in mocks
const {
  mockPrismaOrder,
  mockPrismaOrderItem,
  mockPrismaProduct,
  mockPrismaInventoryMovement,
  mockPrismaAccount,
  mockPrismaJournalEntry,
  mockPrismaSagaLog,
  mockPrismaGoodsReceipt,
  mockPrismaGoodsReceiptItem,
} = vi.hoisted(() => ({
  mockPrismaOrder: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  mockPrismaOrderItem: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  mockPrismaProduct: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  mockPrismaInventoryMovement: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  mockPrismaAccount: {
    findFirst: vi.fn(),
  },
  mockPrismaJournalEntry: {
    create: vi.fn(),
  },
  mockPrismaSagaLog: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  mockPrismaGoodsReceipt: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockPrismaGoodsReceiptItem: {
    createMany: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');
  return {
    ...actual,
    prisma: {
      sagaLog: mockPrismaSagaLog,
      order: mockPrismaOrder,
      orderItem: mockPrismaOrderItem,
      product: mockPrismaProduct,
      inventoryMovement: mockPrismaInventoryMovement,
      account: mockPrismaAccount,
      journalEntry: mockPrismaJournalEntry,
      goodsReceipt: mockPrismaGoodsReceipt,
      goodsReceiptItem: mockPrismaGoodsReceiptItem,
      $transaction: vi
        .fn()
        .mockImplementation(
          async (callback: (tx: any) => Promise<any>) => {
            // Use the SAME mocks so test setup carries into transaction
            const mockTx = {
              $executeRawUnsafe: vi.fn().mockResolvedValue(1),
              order: mockPrismaOrder,
              orderItem: mockPrismaOrderItem,
              product: mockPrismaProduct,
              inventoryMovement: mockPrismaInventoryMovement,
              account: mockPrismaAccount,
              journalEntry: mockPrismaJournalEntry,
              goodsReceipt: mockPrismaGoodsReceipt,
              goodsReceiptItem: mockPrismaGoodsReceiptItem,
            };
            return callback(mockTx);
          }
        ),
    },
  };
});

// Mock InventoryService using vi.hoisted() to avoid initialization order issues
const { mockInventoryService } = vi.hoisted(() => ({
  mockInventoryService: {
    createGRN: vi.fn().mockResolvedValue({
      id: 'grn-1',
      grnNumber: 'GRN-001',
      status: 'DRAFT',
    }),
    postGRN: vi.fn().mockResolvedValue({
      id: 'grn-1',
      status: 'POSTED',
    }),
  },
}));
vi.mock('@modules/inventory/inventory.service', () => ({
  InventoryService: function () {
    return mockInventoryService;
  },
}));

describe('T024: Goods Receipt Saga', () => {
  let saga: GoodsReceiptSaga;

  const mockPO = {
    id: 'po-1',
    companyId: 'co-1',
    orderNumber: 'PO-001',
    status: OrderStatus.CONFIRMED,
    items: [
      { id: 'item-1', productId: 'prod-1', quantity: 10, price: 50 },
    ],
  };

  const mockSagaLog = {
    id: 'saga-1',
    sagaType: SagaType.GOODS_RECEIPT,
    entityId: 'po-1',
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
    saga = new GoodsReceiptSaga();

    // Default saga log mock
    vi.mocked(prisma.sagaLog.create).mockResolvedValue(mockSagaLog);
    vi.mocked(prisma.sagaLog.update).mockResolvedValue({} as any);
    vi.mocked(prisma.sagaLog.findFirst).mockResolvedValue(null);
  });

  describe('Successful Execution', () => {
    it('should receive goods with stock IN and accrual journal', async () => {
      // Mock PO lookup
      vi.mocked(prisma.order.findFirst).mockResolvedValue(
        mockPO as any
      );
      vi.mocked(prisma.order.update).mockResolvedValue({
        ...mockPO,
        status: OrderStatus.COMPLETED,
      } as any);

      // Mock order items
      vi.mocked(prisma.orderItem.findMany).mockResolvedValue([
        {
          id: 'item-1',
          productId: 'prod-1',
          quantity: 10,
          price: 50,
        },
      ] as any);

      // Mock product for stock update
      const mockProduct = {
        id: 'prod-1',
        stockQty: 0,
        averageCost: 0,
        isService: false,
      };
      vi.mocked(prisma.product.findUnique).mockResolvedValue(
        mockProduct as any
      );
      vi.mocked(prisma.product.findFirst).mockResolvedValue(
        mockProduct as any
      );
      vi.mocked(prisma.product.update).mockResolvedValue({} as any);

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
        { orderId: 'po-1', companyId: 'co-1' },
        'po-1',
        'co-1'
      );

      expect(result.success).toBe(true);
      expect(result.data?.movements).toBeDefined();
      expect(result.sagaLogId).toBe('saga-1');
    });
  });

  describe('Idempotency', () => {
    it('should return cached result if saga already completed', async () => {
      // Mock existing completed saga log
      vi.mocked(prisma.sagaLog.findFirst).mockResolvedValue({
        ...mockSagaLog,
        status: SagaStep.COMPLETED,
        step: SagaStep.COMPLETED,
        result: { success: true, sagaLogId: 'saga-1' },
      } as any);

      // Execute again
      const result = await saga.execute(
        { orderId: 'po-1', companyId: 'co-1' },
        'po-1',
        'co-1'
      );

      // Should succeed but NOT call business logic
      expect(result.success).toBe(true);
      expect(result.sagaLogId).toBe('saga-1');
      // Ensure business logic was NOT called
      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('should fail on non-existent PO', async () => {
      vi.mocked(prisma.order.findFirst).mockResolvedValue(null);

      await expect(
        saga.execute(
          { orderId: 'po-999', companyId: 'co-1' },
          'po-999',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });

    it('should fail on cancelled PO', async () => {
      vi.mocked(prisma.order.findFirst).mockResolvedValue({
        ...mockPO,
        status: OrderStatus.CANCELLED,
      } as any);

      await expect(
        saga.execute(
          { orderId: 'po-1', companyId: 'co-1' },
          'po-1',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });

    it('should fail on partial receipt (Phase 1 Restriction)', async () => {
      mockPrismaOrder.findFirst.mockResolvedValue(mockPO as any);
      // Mock order items - PO has 10 items
      mockPrismaOrderItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          productId: 'prod-1',
          quantity: 10,
          price: 50,
        },
      ] as any);

      // Attempt to receive only 5
      await expect(
        saga.execute(
          {
            orderId: 'po-1',
            companyId: 'co-1',
            items: [{ id: 'item-1', quantity: 5 }],
          },
          'po-1',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });
  });

  describe('Compensation', () => {
    it('should revert PO status on failure', async () => {
      vi.mocked(prisma.order.findFirst).mockResolvedValue(
        mockPO as any
      );
      vi.mocked(prisma.order.update).mockResolvedValue({} as any);
      vi.mocked(prisma.orderItem.findMany).mockResolvedValue([
        {
          id: 'item-1',
          productId: 'prod-1',
          quantity: 10,
          price: 50,
        },
      ] as any);

      // Product update fails
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        stockQty: 0,
        averageCost: 0,
        isService: false,
      } as any);
      vi.mocked(prisma.product.update).mockRejectedValue(
        new Error('DB connection failed')
      );

      try {
        await saga.execute(
          { orderId: 'po-1', companyId: 'co-1' },
          'po-1',
          'co-1'
        );
      } catch {
        // Expected
      }

      // Verify compensation was called (order status update)
      expect(prisma.order.update).toHaveBeenCalled();
    });
  });
});
