import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma, SagaType, SagaStep } from '@sync-erp/database';
import * as sagaLogRepo from '@modules/common/saga/saga-log.repository';
import { PostingContext } from '@modules/common/saga/posting-context';
import {
  SagaCompensatedError,
  SagaCompensationFailedError,
  DomainError,
} from '@modules/common/saga/saga-errors';
import { SagaOrchestrator } from '@modules/common/saga/saga-orchestrator';

// Automock prisma
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
        findMany: vi.fn(),
      },
      // Mock $transaction to execute the callback immediately
      $transaction: vi
        .fn()
        .mockImplementation(
          async (callback: (tx: any) => Promise<any>) => {
            // Create a mock tx that passes through to regular prisma mocks
            const mockTx = {
              $executeRawUnsafe: vi.fn().mockResolvedValue(1),
            };
            return callback(mockTx);
          }
        ),
    },
  };
});

describe('T021: SAGA Infrastructure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SagaLog Repository', () => {
    it('should create saga log with PENDING step', async () => {
      vi.mocked(prisma.sagaLog.create).mockResolvedValue({
        id: 'saga-1',
        sagaType: SagaType.INVOICE_POST,
        entityId: 'inv-1',
        companyId: 'co-1',
        step: SagaStep.PENDING,
        stepData: {},
        error: null,
        correlationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await sagaLogRepo.createSagaLog({
        sagaType: SagaType.INVOICE_POST,
        entityId: 'inv-1',
        companyId: 'co-1',
      });

      expect(result.step).toBe(SagaStep.PENDING);
      expect(prisma.sagaLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sagaType: SagaType.INVOICE_POST,
          entityId: 'inv-1',
          companyId: 'co-1',
          step: SagaStep.PENDING,
        }),
      });
    });

    it('should update saga log step', async () => {
      vi.mocked(prisma.sagaLog.update).mockResolvedValue({
        id: 'saga-1',
        step: SagaStep.STOCK_DONE,
      } as any);

      await sagaLogRepo.updateSagaLog('saga-1', {
        step: SagaStep.STOCK_DONE,
        stepData: { stockMovementId: 'mov-1' },
      });

      expect(prisma.sagaLog.update).toHaveBeenCalledWith({
        where: { id: 'saga-1' },
        data: {
          step: SagaStep.STOCK_DONE,
          stepData: { stockMovementId: 'mov-1' },
          error: undefined,
        },
      });
    });

    it('should find saga by entity', async () => {
      vi.mocked(prisma.sagaLog.findFirst).mockResolvedValue({
        id: 'saga-1',
        sagaType: SagaType.INVOICE_POST,
        entityId: 'inv-1',
      } as any);

      const result = await sagaLogRepo.findSagaLogByEntity(
        SagaType.INVOICE_POST,
        'inv-1',
        'co-1'
      );

      expect(result?.id).toBe('saga-1');
      expect(prisma.sagaLog.findFirst).toHaveBeenCalledWith({
        where: {
          sagaType: SagaType.INVOICE_POST,
          entityId: 'inv-1',
          companyId: 'co-1',
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should mark saga as failed with error', async () => {
      vi.mocked(prisma.sagaLog.update).mockResolvedValue({} as any);

      await sagaLogRepo.markSagaFailed(
        'saga-1',
        'Something went wrong'
      );

      expect(prisma.sagaLog.update).toHaveBeenCalledWith({
        where: { id: 'saga-1' },
        data: {
          step: SagaStep.FAILED,
          error: 'Something went wrong',
          stepData: undefined,
        },
      });
    });
  });

  describe('PostingContext', () => {
    it('should create new context with PENDING step', async () => {
      vi.mocked(prisma.sagaLog.create).mockResolvedValue({
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
      });

      const ctx = await PostingContext.create(
        SagaType.SHIPMENT,
        'order-1',
        'co-1'
      );

      expect(ctx.id).toBe('saga-1');
      expect(ctx.step).toBe(SagaStep.PENDING);
      expect(ctx.entityId).toBe('order-1');
    });

    it('should transition through steps correctly', async () => {
      vi.mocked(prisma.sagaLog.create).mockResolvedValue({
        id: 'saga-1',
        sagaType: SagaType.INVOICE_POST,
        entityId: 'inv-1',
        companyId: 'co-1',
        step: SagaStep.PENDING,
        stepData: {},
        error: null,
        correlationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.sagaLog.update).mockResolvedValue({} as any);

      const ctx = await PostingContext.create(
        SagaType.INVOICE_POST,
        'inv-1',
        'co-1'
      );

      await ctx.markStockDone('mov-1');
      expect(ctx.step).toBe(SagaStep.STOCK_DONE);
      expect(ctx.stepData.stockMovementId).toBe('mov-1');

      await ctx.markJournalDone('jnl-1');
      expect(ctx.step).toBe(SagaStep.JOURNAL_DONE);
      expect(ctx.stepData.journalId).toBe('jnl-1');

      await ctx.markCompleted();
      expect(ctx.step).toBe(SagaStep.COMPLETED);
    });

    it('should load existing context from saga log', async () => {
      vi.mocked(prisma.sagaLog.findUnique).mockResolvedValue({
        id: 'saga-1',
        sagaType: SagaType.PAYMENT_POST,
        entityId: 'pay-1',
        companyId: 'co-1',
        step: SagaStep.BALANCE_DONE,
        stepData: { previousBalance: 1000 },
        error: null,
        correlationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const ctx = await PostingContext.load('saga-1');

      expect(ctx).not.toBeNull();
      expect(ctx?.step).toBe(SagaStep.BALANCE_DONE);
      expect(ctx?.stepData.previousBalance).toBe(1000);
    });
  });

  describe('Saga Errors', () => {
    it('SagaCompensatedError should have correct code', () => {
      const originalError = new Error('DB connection failed');
      const error = new SagaCompensatedError('saga-1', originalError);

      expect(error.code).toBe('SAGA_COMPENSATED');
      expect(error.sagaLogId).toBe('saga-1');
      expect(error.originalError).toBe(originalError);
      expect(error.message).toContain('compensated');
    });

    it('SagaCompensationFailedError should indicate manual intervention', () => {
      const originalError = new Error('Journal creation failed');
      const compError = new Error('Stock rollback failed');
      const error = new SagaCompensationFailedError(
        'saga-1',
        originalError,
        compError
      );

      expect(error.code).toBe('SAGA_COMPENSATION_FAILED');
      expect(error.message).toContain('Manual intervention required');
      expect(error.compensationError).toBe(compError);
    });

    it('DomainError should extend Error', () => {
      const error = new DomainError('Test error');
      expect(error instanceof Error).toBe(true);
      expect(error.code).toBe('DOMAIN_ERROR');
    });
  });

  describe('SagaOrchestrator (Abstract)', () => {
    // Concrete implementation for testing
    class TestSaga extends SagaOrchestrator<
      { value: number },
      { result: string }
    > {
      protected readonly sagaType = SagaType.INVOICE_POST;
      public shouldFail = false;
      public shouldFailCompensation = false;

      protected getLockTable(): string {
        return 'Invoice';
      }

      protected async executeSteps(
        input: { value: number },
        context: PostingContext
      ): Promise<{ result: string }> {
        if (this.shouldFail) {
          throw new Error('Execution failed');
        }
        await context.markStockDone('mov-test');
        return { result: `Result: ${input.value}` };
      }

      protected async compensate(
        _context: PostingContext
      ): Promise<void> {
        if (this.shouldFailCompensation) {
          throw new Error('Compensation failed');
        }
        // Compensation logic here
      }
    }

    it('should execute saga successfully', async () => {
      vi.mocked(prisma.sagaLog.create).mockResolvedValue({
        id: 'saga-1',
        sagaType: SagaType.INVOICE_POST,
        entityId: 'entity-1',
        companyId: 'co-1',
        step: SagaStep.PENDING,
        stepData: {},
        error: null,
        correlationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.sagaLog.update).mockResolvedValue({} as any);

      const saga = new TestSaga();
      const result = await saga.execute(
        { value: 42 },
        'entity-1',
        'co-1'
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'Result: 42' });
      expect(result.sagaLogId).toBe('saga-1');
    });

    it('should compensate on failure and throw SagaCompensatedError', async () => {
      vi.mocked(prisma.sagaLog.create).mockResolvedValue({
        id: 'saga-1',
        sagaType: SagaType.INVOICE_POST,
        entityId: 'entity-1',
        companyId: 'co-1',
        step: SagaStep.PENDING,
        stepData: {},
        error: null,
        correlationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.sagaLog.update).mockResolvedValue({} as any);

      const saga = new TestSaga();
      saga.shouldFail = true;

      await expect(
        saga.execute({ value: 42 }, 'entity-1', 'co-1')
      ).rejects.toThrow(SagaCompensatedError);
    });

    it('should throw SagaCompensationFailedError when compensation fails', async () => {
      vi.mocked(prisma.sagaLog.create).mockResolvedValue({
        id: 'saga-1',
        sagaType: SagaType.INVOICE_POST,
        entityId: 'entity-1',
        companyId: 'co-1',
        step: SagaStep.PENDING,
        stepData: {},
        error: null,
        correlationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.sagaLog.update).mockResolvedValue({} as any);

      const saga = new TestSaga();
      saga.shouldFail = true;
      saga.shouldFailCompensation = true;

      await expect(
        saga.execute({ value: 42 }, 'entity-1', 'co-1')
      ).rejects.toThrow(SagaCompensationFailedError);
    });
  });
});
