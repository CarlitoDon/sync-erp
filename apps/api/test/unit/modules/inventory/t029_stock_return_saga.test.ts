import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma, SagaType, SagaStep } from '@sync-erp/database';
import { StockReturnSaga } from '../../../../src/modules/inventory/sagas/stock-return.saga';
import { SagaCompensatedError } from '../../../../src/modules/common/saga/saga-errors';

vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');
  const mockSagaLog = {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  };
  return {
    ...actual,
    prisma: {
      sagaLog: mockSagaLog,
      product: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      inventoryMovement: { create: vi.fn() },
      account: { findFirst: vi.fn() },
      journalEntry: { create: vi.fn(), update: vi.fn() },
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

describe('T029: Stock Return Saga', () => {
  let saga: StockReturnSaga;

  const mockProduct = {
    id: 'prod-1',
    companyId: 'co-1',
    name: 'Test Product',
    stockQty: 100,
    averageCost: 50,
  };

  const mockSagaLog = {
    id: 'saga-1',
    sagaType: SagaType.STOCK_RETURN,
    entityId: 'prod-1',
    companyId: 'co-1',
    step: SagaStep.PENDING,
    stepData: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    saga = new StockReturnSaga();
    // Default saga log mock
    vi.mocked(prisma.sagaLog.create).mockResolvedValue(
      mockSagaLog as any
    );
    vi.mocked(prisma.sagaLog.update).mockResolvedValue({} as any);
    vi.mocked(prisma.sagaLog.findFirst).mockResolvedValue(null);
  });

  describe('Successful Execution', () => {
    it('should return stock with movement and journal', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue(
        mockProduct as any
      );
      vi.mocked(prisma.product.findFirst).mockResolvedValue(
        mockProduct as any
      );
      vi.mocked(prisma.product.update).mockResolvedValue({} as any);
      vi.mocked(prisma.inventoryMovement.create).mockResolvedValue({
        id: 'mov-1',
      } as any);
      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: 'acc-1',
      } as any);
      vi.mocked(prisma.journalEntry.create).mockResolvedValue({
        id: 'jnl-1',
      } as any);

      const result = await saga.execute(
        {
          companyId: 'co-1',
          productId: 'prod-1',
          quantity: 5,
          costPerUnit: 45,
        },
        'prod-1',
        'co-1'
      );

      expect(result.success).toBe(true);
      expect(result.data?.movement.id).toBe('mov-1');
    });
  });

  describe('Validation', () => {
    it('should fail on non-existent product', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.product.findFirst).mockResolvedValue(null);

      await expect(
        saga.execute(
          {
            companyId: 'co-1',
            productId: 'prod-999',
            quantity: 5,
            costPerUnit: 45,
          },
          'prod-999',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });
  });
});
