/**
 * Order utility functions shared between PurchaseOrderService and SalesOrderService.
 * Extracted to reduce code duplication.
 */

import {
  Order,
  OrderStatus,
  AuditLogAction,
  EntityType,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { recordAudit } from '../audit/audit-log.service';

/**
 * Calculate DP (Down Payment) amount from percent or return manual amount.
 * Priority: dpAmount (manual) > dpPercent (calculated)
 *
 * @param totalAmount - Total order amount
 * @param dpPercent - Optional DP percentage (0-100)
 * @param dpAmount - Optional manual DP amount
 * @returns Calculated DP amount or null if no DP required
 */
export function calculateDpAmount(
  totalAmount: number,
  dpPercent?: number,
  dpAmount?: number
): number | null {
  if (dpAmount !== undefined && dpAmount > 0) {
    return dpAmount;
  }
  if (dpPercent !== undefined && dpPercent > 0) {
    return (totalAmount * dpPercent) / 100;
  }
  return null;
}

/**
 * Configuration for close operation
 */
export interface CloseOrderConfig {
  /** Order ID */
  id: string;
  /** Company ID */
  companyId: string;
  /** Actor ID for audit */
  userId: string;
  /** Mandatory close reason */
  reason: string;
  /** Human-readable order name (e.g., "Purchase Order") */
  orderName: string;
  /** Allowed statuses for close (e.g., CONFIRMED, PARTIALLY_RECEIVED) */
  allowedStatuses: OrderStatus[];
}

/**
 * Common close order validation and audit.
 * Validates the close operation and records audit - caller must update status.
 *
 * @param order - The order to close
 * @param config - Close configuration
 * @returns void - throws DomainError on validation failure
 */
export async function validateAndAuditClose(
  order: Order | null,
  config: CloseOrderConfig
): Promise<void> {
  // Validate reason is provided
  if (!config.reason || config.reason.trim().length === 0) {
    throw new DomainError(
      'Close reason is required',
      400,
      DomainErrorCodes.OPERATION_NOT_ALLOWED
    );
  }

  if (!order) {
    throw new DomainError(
      `${config.orderName} not found`,
      404,
      DomainErrorCodes.ORDER_NOT_FOUND
    );
  }

  // Validate status
  if (!config.allowedStatuses.includes(order.status)) {
    const statusNames = config.allowedStatuses.join(' or ');
    throw new DomainError(
      `Cannot close ${config.orderName} in status ${order.status}. Must be ${statusNames}.`,
      400,
      DomainErrorCodes.ORDER_INVALID_STATE
    );
  }

  // Record audit with close reason
  await recordAudit({
    companyId: config.companyId,
    actorId: config.userId,
    action: AuditLogAction.ORDER_CANCELLED,
    entityType: EntityType.ORDER,
    entityId: config.id,
    businessDate: new Date(),
    payloadSnapshot: {
      previousStatus: order.status,
      newStatus: OrderStatus.COMPLETED,
      action: 'CLOSE',
      reason: config.reason,
    },
  });
}

/**
 * Configuration for recalculate status operation
 */
export interface RecalculateStatusConfig {
  /** Status when 0 < fulfilled < ordered */
  partialStatus: OrderStatus;
  /** Status when fulfilled >= ordered */
  fulfilledStatus: OrderStatus;
}

/**
 * Calculate new order status based on fulfillment.
 *
 * @param order - The order
 * @param fulfilledQty - Map of productId -> fulfilled quantity
 * @param config - Status configuration
 * @returns New status, or null if no change needed
 */
export function calculateNewOrderStatus(
  order: Order & {
    items: Array<{ productId: string; quantity: number }>;
  },
  fulfilledQty: Map<string, number>,
  config: RecalculateStatusConfig
): OrderStatus | null {
  // Don't recalculate if already CANCELLED or DRAFT
  if (
    order.status === OrderStatus.CANCELLED ||
    order.status === OrderStatus.DRAFT
  ) {
    return null;
  }

  // Calculate totals
  let totalOrdered = 0;
  let totalFulfilled = 0;
  for (const item of order.items) {
    totalOrdered += item.quantity;
    totalFulfilled += fulfilledQty.get(item.productId) || 0;
  }

  // Determine new status
  let newStatus: OrderStatus;
  if (totalFulfilled === 0) {
    newStatus = OrderStatus.CONFIRMED;
  } else if (totalFulfilled < totalOrdered) {
    newStatus = config.partialStatus;
  } else {
    newStatus = config.fulfilledStatus;
  }

  // Return null if no change
  if (newStatus === order.status) {
    return null;
  }

  return newStatus;
}
