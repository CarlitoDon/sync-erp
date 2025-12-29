/**
 * Document utility functions shared between InvoiceService and BillService.
 * Extracted to reduce code duplication.
 */

import {
  InvoiceStatus,
  AuditLogAction,
  EntityType,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { recordAudit } from '../audit/audit-log.service';

/**
 * Document type configuration for void operations
 */
export interface VoidDocumentConfig {
  /** Document ID */
  id: string;
  /** Company ID */
  companyId: string;
  /** Actor ID for audit */
  actorId: string;
  /** Mandatory void reason */
  reason: string;
  /** Human-readable document name (e.g., "Invoice", "Bill") */
  documentName: string;
  /** Required permission (e.g., "invoice:void", "bill:void") */
  requiredPermission: string;
  /** User's permissions array */
  userPermissions?: string[];
  /** Audit action for void (e.g., INVOICE_VOIDED, BILL_VOIDED) */
  auditAction: AuditLogAction;
  /** Entity type for audit (e.g., INVOICE, BILL) */
  entityType: EntityType;
  /** Error code when document not found */
  notFoundErrorCode: string;
  /** Error code when document has invalid state */
  invalidStateErrorCode: string;
  /** Error code when document has payments */
  hasPaymentsErrorCode: string;
}

/**
 * Validate permission for void operation.
 *
 * @param config - Void configuration
 * @throws DomainError if permission is missing
 */
export function validateVoidPermission(
  config: VoidDocumentConfig
): void {
  const hasPermission =
    config.userPermissions?.includes(config.requiredPermission) ||
    config.userPermissions?.includes(
      `${config.documentName.toLowerCase()}:*`
    ) ||
    config.userPermissions?.includes('*:*');

  if (!hasPermission) {
    throw new DomainError(
      `Missing permission: ${config.requiredPermission}`,
      403,
      DomainErrorCodes.FORBIDDEN
    );
  }
}

/**
 * Validate void reason is provided.
 *
 * @param reason - Void reason
 * @throws DomainError if reason is empty
 */
export function validateVoidReason(reason: string): void {
  if (!reason || reason.trim().length === 0) {
    throw new DomainError(
      'Void reason is required',
      400,
      DomainErrorCodes.OPERATION_NOT_ALLOWED
    );
  }
}

/**
 * Record audit log for void operation.
 *
 * @param config - Void configuration
 */
export async function recordVoidAudit(
  config: VoidDocumentConfig
): Promise<void> {
  await recordAudit({
    companyId: config.companyId,
    actorId: config.actorId,
    action: config.auditAction,
    entityType: config.entityType,
    entityId: config.id,
    businessDate: new Date(),
    payloadSnapshot: { reason: config.reason },
  });
}

/**
 * Validate document can be voided.
 *
 * @param document - The document to void (or null if not found)
 * @param paymentCount - Number of payments linked to document
 * @param config - Void configuration
 * @throws DomainError if document cannot be voided
 */
export function validateCanVoid(
  document: { status: InvoiceStatus } | null,
  paymentCount: number,
  config: VoidDocumentConfig
): void {
  if (!document) {
    throw new DomainError(
      `${config.documentName} not found`,
      404,
      config.notFoundErrorCode
    );
  }

  if (document.status === InvoiceStatus.VOID) {
    throw new DomainError(
      `${config.documentName} is already voided`,
      422,
      config.invalidStateErrorCode
    );
  }

  if (document.status === InvoiceStatus.DRAFT) {
    throw new DomainError(
      `Cannot void DRAFT ${config.documentName.toLowerCase()}. Delete it instead.`,
      422,
      config.invalidStateErrorCode
    );
  }

  if (paymentCount > 0) {
    throw new DomainError(
      `Cannot void ${config.documentName.toLowerCase()}: Payments have been recorded. Void the payments first.`,
      422,
      config.hasPaymentsErrorCode
    );
  }
}

/**
 * Combined validation and audit for void operation.
 * Performs permission check, reason validation, and records audit log.
 *
 * @param config - Void configuration
 */
export async function validateAndAuditVoid(
  config: VoidDocumentConfig
): Promise<void> {
  validateVoidPermission(config);
  validateVoidReason(config.reason);
  await recordVoidAudit(config);
}
