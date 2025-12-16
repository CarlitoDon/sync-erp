// Posting Context - Step tracking class for saga orchestration
import { SagaType, SagaStep, Prisma } from '@sync-erp/database';
import * as sagaLogRepo from './saga-log.repository.js';

/**
 * StepData holds IDs created during saga execution for compensation
 */
export interface StepData {
  [key: string]: string | number | undefined;
  stockMovementId?: string;
  stockMovementId2?: string; // For transfers (source + destination)
  journalId?: string;
  paymentId?: string;
  previousBalance?: number;
}

/**
 * PostingContext - Manages saga step tracking and persistence
 *
 * Each saga creates a PostingContext at start, updates it as steps complete,
 * and uses it for compensation if needed.
 */
export class PostingContext {
  private readonly _id: string;
  private readonly _sagaType: SagaType;
  private readonly _entityId: string;
  private readonly _companyId: string;
  private _step: SagaStep;
  private _stepData: StepData;
  private _error: string | null;

  private constructor(
    id: string,
    sagaType: SagaType,
    entityId: string,
    companyId: string,
    step: SagaStep,
    stepData: StepData,
    error: string | null
  ) {
    this._id = id;
    this._sagaType = sagaType;
    this._entityId = entityId;
    this._companyId = companyId;
    this._step = step;
    this._stepData = stepData;
    this._error = error;
  }

  // Getters (readonly)
  get id(): string {
    return this._id;
  }
  get sagaType(): SagaType {
    return this._sagaType;
  }
  get entityId(): string {
    return this._entityId;
  }
  get companyId(): string {
    return this._companyId;
  }
  get step(): SagaStep {
    return this._step;
  }
  get stepData(): StepData {
    return { ...this._stepData };
  }
  get error(): string | null {
    return this._error;
  }

  /**
   * Create a new PostingContext (starts saga)
   */
  static async create(
    sagaType: SagaType,
    entityId: string,
    companyId: string
  ): Promise<PostingContext> {
    const sagaLog = await sagaLogRepo.createSagaLog({
      sagaType,
      entityId,
      companyId,
      step: SagaStep.PENDING,
      stepData: {},
    });

    return new PostingContext(
      sagaLog.id,
      sagaType,
      entityId,
      companyId,
      SagaStep.PENDING,
      {},
      null
    );
  }

  /**
   * Load existing PostingContext from saga log
   */
  static async load(
    sagaLogId: string
  ): Promise<PostingContext | null> {
    const sagaLog = await sagaLogRepo.findSagaLogById(sagaLogId);
    if (!sagaLog) return null;

    return new PostingContext(
      sagaLog.id,
      sagaLog.sagaType,
      sagaLog.entityId,
      sagaLog.companyId,
      sagaLog.step,
      (sagaLog.stepData as StepData) ?? {},
      sagaLog.error
    );
  }

  // State transitions
  async markStockDone(
    movementId: string,
    movementId2?: string
  ): Promise<void> {
    this._step = SagaStep.STOCK_DONE;
    this._stepData.stockMovementId = movementId;
    if (movementId2) {
      this._stepData.stockMovementId2 = movementId2;
    }
    await this.save();
  }

  async markBalanceDone(previousBalance?: number): Promise<void> {
    this._step = SagaStep.BALANCE_DONE;
    if (previousBalance !== undefined) {
      this._stepData.previousBalance = previousBalance;
    }
    await this.save();
  }

  async markJournalDone(journalId: string): Promise<void> {
    this._step = SagaStep.JOURNAL_DONE;
    this._stepData.journalId = journalId;
    await this.save();
  }

  async markCompleted(): Promise<void> {
    this._step = SagaStep.COMPLETED;
    this._error = null;
    await this.save();
  }

  async markFailed(error: Error): Promise<void> {
    this._step = SagaStep.FAILED;
    this._error = error.message;
    await this.save();
  }

  async markCompensationFailed(error: Error): Promise<void> {
    this._step = SagaStep.COMPENSATION_FAILED;
    this._error = error.message;
    await this.save();
  }

  /**
   * Persist current state to database
   */
  private async save(): Promise<void> {
    await sagaLogRepo.updateSagaLog(this._id, {
      step: this._step,
      stepData: this._stepData as Prisma.InputJsonValue,
      error: this._error,
    });
  }
}
