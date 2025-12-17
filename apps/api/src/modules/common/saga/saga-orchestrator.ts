// Saga Orchestrator - Abstract base class for saga implementations
import {
  SagaType,
  type SagaLog,
  prisma,
  Prisma,
} from '@sync-erp/database';
import { PostingContext, StepData } from './posting-context.js';
import * as sagaLogRepo from './saga-log.repository.js';
import {
  SagaCompensatedError,
  SagaCompensationFailedError,
} from './saga-errors.js';

/**
 * Result of saga execution
 */
export interface SagaResult<T> {
  success: boolean;
  data?: T;
  sagaLogId: string;
  error?: Error;
}

/**
 * Abstract base class for saga orchestrators
 *
 * Subclasses must implement:
 * - sagaType: The type of saga
 * - getLockTable(): The DB table to lock (for concurrency safety)
 * - executeSteps(): The forward execution logic
 * - compensate(): The rollback logic
 */
export abstract class SagaOrchestrator<TInput, TOutput> {
  protected abstract readonly sagaType: SagaType;

  /**
   * The database table name to lock for concurrency safety.
   * e.g. "Invoice", "Payment"
   */
  protected abstract getLockTable(): string;

  /**
   * Acquire a strict database row lock on the entity.
   * MUST be called within a transaction.
   * @param input - The input data, useful if locking a related entity (e.g. Payment locking Invoice)
   */
  protected async lockEntity(
    tx: Prisma.TransactionClient,
    entityId: string,
    _input: TInput
  ): Promise<void> {
    const table = this.getLockTable();
    // Use executeRawUnsafe because table name is dynamic (but trusted from subclass)
    // SELECT 1 ... FOR UPDATE ensures we wait for any other transaction on this ID
    await tx.$executeRawUnsafe(
      `SELECT 1 FROM "${table}" WHERE id = $1 FOR UPDATE`,
      entityId
    );
  }

  /**
   * Execute the saga with automatic compensation on failure
   */
  async execute(
    input: TInput,
    entityId: string,
    companyId: string
  ): Promise<SagaResult<TOutput>> {
    // 0. Idempotency Check
    // If saga is already completed, return cached result immediately
    const existingLog = await this.getStatus(entityId, companyId);
    if (existingLog && existingLog.step === 'COMPLETED') {
      const stepData = existingLog.stepData as unknown as StepData;
      // Ideally we should cast to StepData but it's not exported from database package
      const resultData = stepData?.result;
      return {
        success: true,
        data: resultData as TOutput,
        sagaLogId: existingLog.id,
      };
    }

    // Create posting context (starts saga) - OUTSIDE transaction
    // This ensures the generic "PENDING" log exists even if the transaction fails immediately
    const context = await PostingContext.create(
      this.sagaType,
      entityId,
      companyId
    );

    try {
      // Execute forward steps within a single ACID transaction
      const result = await prisma.$transaction(
        async (tx) => {
          // 1. Acquire Lock
          await this.lockEntity(tx, entityId, input);

          // 2. Execute Steps
          return this.executeSteps(input, context, tx);
        },
        {
          timeout: 60000, // Wait up to 60s for transaction (Prisma Postgres)
        }
      );

      // Mark completed (Outside transaction)
      // Since transaction committed, the business work is done.
      await context.markCompleted(result);

      return {
        success: true,
        data: result,
        sagaLogId: context.id,
      };
    } catch (error) {
      // Forward execution failed (Transaction Rolled Back)
      // Any DB changes in executeSteps are gone.
      const originalError =
        error instanceof Error ? error : new Error(String(error));

      try {
        // Attempt compensation (clean up side effects or explicitly needed logic)
        // Note: DB changes from executeSteps are already rolled back interactively.
        await this.compensate(context);
        await context.markFailed(originalError);

        // Compensation succeeded - throw compensated error
        throw new SagaCompensatedError(context.id, originalError);
      } catch (compensationError) {
        // Check if this is already a SagaCompensatedError (compensation succeeded)
        if (compensationError instanceof SagaCompensatedError) {
          throw compensationError;
        }

        // Compensation also failed - critical situation
        const compError =
          compensationError instanceof Error
            ? compensationError
            : new Error(String(compensationError));

        await context.markCompensationFailed(compError);

        throw new SagaCompensationFailedError(
          context.id,
          originalError,
          compError
        );
      }
    }
  }

  /**
   * Retry a failed saga
   */
  async retry(
    sagaLogId: string,
    input: TInput
  ): Promise<SagaResult<TOutput>> {
    const context = await PostingContext.load(sagaLogId);
    if (!context) {
      throw new Error(`Saga log not found: ${sagaLogId}`);
    }

    // Can only retry FAILED sagas (not COMPENSATION_FAILED - needs manual fix)
    if (context.step !== 'FAILED') {
      throw new Error(
        `Cannot retry saga in step ${context.step}. Only FAILED sagas can be retried.`
      );
    }

    // Re-execute from current state
    try {
      // For retry, we also ideally want locking, but 'execute' is the main entry.
      // 'retry' logic here bypasses 'execute' and calls 'executeSteps' directly.
      // To satisfy D2, Retry MUST also lock.

      // We wrap retry logic in transaction too.
      const result = await prisma.$transaction(
        async (tx) => {
          // We need entityId. context.entityId should exist.
          await this.lockEntity(tx, context.entityId, input);
          return this.executeSteps(input, context, tx);
        },
        { timeout: 60000 }
      );

      await context.markCompleted();

      return {
        success: true,
        data: result,
        sagaLogId: context.id,
      };
    } catch (error) {
      const originalError =
        error instanceof Error ? error : new Error(String(error));
      await context.markFailed(originalError);

      return {
        success: false,
        sagaLogId: context.id,
        error: originalError,
      };
    }
  }

  /**
   * Get saga status for an entity
   */
  async getStatus(
    entityId: string,
    companyId: string
  ): Promise<SagaLog | null> {
    return sagaLogRepo.findSagaLogByEntity(
      this.sagaType,
      entityId,
      companyId
    );
  }

  /**
   * Execute the forward steps of the saga
   * Must update context.step as each step completes
   * @param tx Optional transaction client (should be used for all DB ops)
   */
  protected abstract executeSteps(
    input: TInput,
    context: PostingContext,
    tx?: Prisma.TransactionClient
  ): Promise<TOutput>;

  /**
   * Compensate (rollback) the saga based on current step
   * Should reverse steps in reverse order based on context.stepData
   */
  protected abstract compensate(
    context: PostingContext
  ): Promise<void>;
}
