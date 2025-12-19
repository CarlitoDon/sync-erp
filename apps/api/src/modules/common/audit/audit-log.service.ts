// Audit Log Service - Business-level audit recording
// Records business intent BEFORE saga execution per FR-010.1
import {
  AuditLogAction,
  EntityType,
  type Prisma,
} from '@sync-erp/database';
import * as auditLogRepo from './audit-log.repository.js';

export interface RecordAuditInput {
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
 * Record a business action audit log.
 * This should be called BEFORE triggering any Saga.
 * Per FR-010.1: "Audit logs MUST NOT depend on saga completion"
 */
export async function recordAudit(input: RecordAuditInput) {
  return auditLogRepo.createAuditLog({
    companyId: input.companyId,
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    businessDate: input.businessDate,
    payloadSnapshot: input.payloadSnapshot,
    correlationId: input.correlationId,
  });
}

/**
 * Check if an action was already audited (for idempotency)
 */
export async function hasAuditedAction(
  companyId: string,
  action: AuditLogAction,
  entityId: string,
  correlationId?: string
): Promise<boolean> {
  return auditLogRepo.hasAuditLogForAction(
    companyId,
    action,
    entityId,
    correlationId
  );
}

/**
 * Get audit trail for an entity
 */
export async function getAuditTrail(
  companyId: string,
  entityType: EntityType,
  entityId: string
) {
  return auditLogRepo.findAuditLogsByEntity(
    companyId,
    entityType,
    entityId
  );
}
