// Audit Log Repository - CRUD operations for business audit trail
import {
  prisma,
  AuditLogAction,
  EntityType,
  type AuditLog,
  type Prisma,
} from '@sync-erp/database';

export interface CreateAuditLogInput {
  companyId: string;
  actorId: string;
  action: AuditLogAction;
  entityType: EntityType;
  entityId: string;
  businessDate: Date;
  payloadSnapshot?: Prisma.InputJsonValue;
  correlationId?: string;
}

/**
 * Create an audit log entry (Business intent recording)
 * Called BEFORE triggering Saga execution per FR-010.1
 */
export async function createAuditLog(
  input: CreateAuditLogInput
): Promise<AuditLog> {
  return prisma.auditLog.create({
    data: {
      companyId: input.companyId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      businessDate: input.businessDate,
      payloadSnapshot: input.payloadSnapshot,
      correlationId: input.correlationId ?? null,
    },
  });
}

/**
 * Find audit log by correlation ID (for idempotency check)
 */
export async function findAuditLogByCorrelationId(
  companyId: string,
  correlationId: string
): Promise<AuditLog | null> {
  return prisma.auditLog.findFirst({
    where: {
      companyId,
      correlationId,
    },
  });
}

/**
 * Find audit log by entity
 */
export async function findAuditLogsByEntity(
  companyId: string,
  entityType: EntityType,
  entityId: string
): Promise<AuditLog[]> {
  return prisma.auditLog.findMany({
    where: {
      companyId,
      entityType,
      entityId,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Find audit logs by action type within date range
 */
export async function findAuditLogsByAction(
  companyId: string,
  action: AuditLogAction,
  fromDate?: Date,
  toDate?: Date
): Promise<AuditLog[]> {
  return prisma.auditLog.findMany({
    where: {
      companyId,
      action,
      ...(fromDate || toDate
        ? {
            businessDate: {
              ...(fromDate && { gte: fromDate }),
              ...(toDate && { lte: toDate }),
            },
          }
        : {}),
    },
    orderBy: { businessDate: 'desc' },
  });
}

/**
 * Check if an action was already recorded (idempotency)
 */
export async function hasAuditLogForAction(
  companyId: string,
  action: AuditLogAction,
  entityId: string,
  correlationId?: string
): Promise<boolean> {
  const existing = await prisma.auditLog.findFirst({
    where: {
      companyId,
      action,
      entityId,
      ...(correlationId ? { correlationId } : {}),
    },
    select: { id: true },
  });
  return existing !== null;
}
