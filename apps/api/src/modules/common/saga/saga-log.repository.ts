// SAGA Log Repository - CRUD operations for saga tracking
import {
  prisma,
  Prisma,
  SagaType,
  SagaStep,
  type SagaLog,
} from '@sync-erp/database';

export interface CreateSagaLogInput {
  sagaType: SagaType;
  entityId: string;
  companyId: string;
  step?: SagaStep;
  stepData?: Prisma.InputJsonValue;
}

export interface UpdateSagaLogInput {
  step?: SagaStep;
  stepData?: Prisma.InputJsonValue;
  error?: string | null;
}

/**
 * Create a new saga log entry
 */
export async function createSagaLog(
  input: CreateSagaLogInput
): Promise<SagaLog> {
  return prisma.sagaLog.create({
    data: {
      sagaType: input.sagaType,
      entityId: input.entityId,
      companyId: input.companyId,
      step: input.step ?? SagaStep.PENDING,
      stepData: input.stepData ?? Prisma.JsonNull,
    },
  });
}

/**
 * Update saga log step and data
 */
export async function updateSagaLog(
  id: string,
  input: UpdateSagaLogInput
): Promise<SagaLog> {
  return prisma.sagaLog.update({
    where: { id },
    data: {
      step: input.step,
      stepData: input.stepData,
      error: input.error,
    },
  });
}

/**
 * Find saga log by ID
 */
export async function findSagaLogById(
  id: string
): Promise<SagaLog | null> {
  return prisma.sagaLog.findUnique({
    where: { id },
  });
}

/**
 * Find saga log by entity
 */
export async function findSagaLogByEntity(
  sagaType: SagaType,
  entityId: string,
  companyId: string
): Promise<SagaLog | null> {
  return prisma.sagaLog.findFirst({
    where: {
      sagaType,
      entityId,
      companyId,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Find all failed sagas requiring manual intervention
 */
export async function findCompensationFailedSagas(
  companyId: string
): Promise<SagaLog[]> {
  return prisma.sagaLog.findMany({
    where: {
      companyId,
      step: SagaStep.COMPENSATION_FAILED,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Mark saga as completed
 */
export async function markSagaCompleted(
  id: string
): Promise<SagaLog> {
  return updateSagaLog(id, { step: SagaStep.COMPLETED, error: null });
}

/**
 * Mark saga as failed with error
 */
export async function markSagaFailed(
  id: string,
  error: string
): Promise<SagaLog> {
  return updateSagaLog(id, { step: SagaStep.FAILED, error });
}

/**
 * Mark saga compensation as failed (needs manual intervention)
 */
export async function markSagaCompensationFailed(
  id: string,
  error: string
): Promise<SagaLog> {
  return updateSagaLog(id, {
    step: SagaStep.COMPENSATION_FAILED,
    error,
  });
}
