import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma, SagaType, SagaStep } from '@sync-erp/database';
import { StockTransferSaga } from '../../../../src/modules/inventory/sagas/stock-transfer.saga';
import { SagaCompensatedError } from '../../../../src/modules/common/saga/saga-errors';

vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');
  return {
    ...actual,
    prisma: {
      sagaLog: { create: vi.fn(), update: vi.fn() },
      product: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      inventoryMovement: { create: vi.fn() },
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

describe('T028: Stock Transfer Saga', () => {
  let saga: StockTransferSaga;

  const mockProduct = {
    id: 'prod-1',
    companyId: 'co-1',
    name: 'Test Product',
    stockQty: 100,
    averageCost: 50,
  };

  const mockSagaLog = {
    id: 'saga-1',
    sagaType: SagaType.STOCK_TRANSFER,
    entityId: 'prod-1',
    companyId: 'co-1',
    step: SagaStep.PENDING,
    stepData: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    saga = new StockTransferSaga();
    vi.mocked(prisma.sagaLog.create).mockResolvedValue(
      mockSagaLog as any
    );
    vi.mocked(prisma.sagaLog.update).mockResolvedValue({} as any);
  });

  describe('Successful Execution', () => {
    it('should transfer stock with outbound and inbound movements', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue(
        mockProduct as any
      );
      vi.mocked(prisma.product.findFirst).mockResolvedValue(
        mockProduct as any
      );
      vi.mocked(prisma.product.update).mockResolvedValue({} as any);
      vi.mocked(prisma.inventoryMovement.create)
        .mockResolvedValueOnce({ id: 'mov-out' } as any)
        .mockResolvedValueOnce({ id: 'mov-in' } as any);

      const result = await saga.execute(
        { companyId: 'co-1', productId: 'prod-1', quantity: 10 },
        'prod-1',
        'co-1'
      );

      expect(result.success).toBe(true);
      expect(result.data?.outboundMovement.id).toBe('mov-out');
      expect(result.data?.inboundMovement.id).toBe('mov-in');
    });
  });

  describe('Validation', () => {
    it('should fail on insufficient stock', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        ...mockProduct,
        stockQty: 5,
      } as any);
      vi.mocked(prisma.product.findFirst).mockResolvedValue({
        ...mockProduct,
        stockQty: 5,
      } as any);

      await expect(
        saga.execute(
          { companyId: 'co-1', productId: 'prod-1', quantity: 10 },
          'prod-1',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });
  });
});
