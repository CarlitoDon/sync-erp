// Saga Orchestrator - Abstract base class for saga implementations
import { SagaType, type SagaLog } from '@sync-erp/database';
import { PostingContext } from './posting-context.js';
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
 * - executeSteps(): The forward execution logic
 * - compensate(): The rollback logic
 */
export abstract class SagaOrchestrator<TInput, TOutput> {
  protected abstract readonly sagaType: SagaType;

  /**
   * Execute the saga with automatic compensation on failure
   */
  async execute(
    input: TInput,
    entityId: string,
    companyId: string
  ): Promise<SagaResult<TOutput>> {
    // Create posting context (starts saga)
    const context = await PostingContext.create(
      this.sagaType,
      entityId,
      companyId
    );

    try {
      // Execute forward steps
      const result = await this.executeSteps(input, context);

      // Mark completed
      await context.markCompleted();

      return {
        success: true,
        data: result,
        sagaLogId: context.id,
      };
    } catch (error) {
      // Forward execution failed, attempt compensation
      const originalError =
        error instanceof Error ? error : new Error(String(error));

      try {
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
      const result = await this.executeSteps(input, context);
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
   */
  protected abstract executeSteps(
    input: TInput,
    context: PostingContext
  ): Promise<TOutput>;

  /**
   * Compensate (rollback) the saga based on current step
   * Should reverse steps in reverse order based on context.stepData
   */
  protected abstract compensate(
    context: PostingContext
  ): Promise<void>;
}
