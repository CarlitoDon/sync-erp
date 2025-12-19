/**
 * Procurement Policy
 *
 * Enforces BusinessShape constraints for procurement operations.
 * Mirror of SalesPolicy for Modular Parity (Constitution Principle X).
 *
 * Pattern: Policy.ensure*() throws DomainError if constraint violated.
 */

import { BusinessShape } from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { OrderStatus } from '@sync-erp/database';

/**
 * PurchaseOrderPolicy - Shape-based constraints and Status Guards.
 */
export class PurchaseOrderPolicy {
  /**
   * Check if purchasing physical goods is allowed.
   * SERVICE companies can only purchase services, not physical goods.
   */
  static canPurchasePhysicalGoods(shape: BusinessShape): boolean {
    return (
      shape !== BusinessShape.SERVICE &&
      shape !== BusinessShape.PENDING
    );
  }

  /**
   * Ensure purchasing physical goods is allowed, throw if not.
   */
  static ensureCanPurchasePhysicalGoods(shape: BusinessShape): void {
    if (shape === BusinessShape.PENDING) {
      throw new DomainError(
        'Operations blocked until business shape is selected',
        400,
        DomainErrorCodes.SHAPE_PENDING
      );
    }

    if (!this.canPurchasePhysicalGoods(shape)) {
      throw new DomainError(
        'Service companies can only purchase services, not physical goods',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Check if purchase orders are allowed.
   * All shapes except PENDING can create purchase orders.
   */
  static canCreatePurchaseOrder(shape: BusinessShape): boolean {
    return shape !== BusinessShape.PENDING;
  }

  /**
   * Ensure purchase order creation is allowed.
   */
  static ensureCanCreatePurchaseOrder(shape: BusinessShape): void {
    if (shape === BusinessShape.PENDING) {
      throw new DomainError(
        'Operations blocked until business shape is selected',
        400,
        DomainErrorCodes.SHAPE_PENDING
      );
    }
  }

  /**
   * Validate update rules
   * - State Guard: Must be DRAFT
   * - Immutable: orderNumber
   */
  static validateUpdate(
    existingStatus: string,
    data: { orderNumber?: string },
    existingOrderNumber: string | null
  ): void {
    if (existingStatus !== OrderStatus.DRAFT) {
      throw new DomainError(
        'Order is not in the correct state for this action',
        422,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }

    if (
      data.orderNumber &&
      existingOrderNumber &&
      data.orderNumber !== existingOrderNumber
    ) {
      throw new DomainError(
        'Order number cannot be changed',
        400,
        DomainErrorCodes.MUTATION_BLOCKED
      );
    }
  }

  static validateConfirm(status: string): void {
    if (status !== OrderStatus.DRAFT) {
      throw new DomainError(
        `Cannot confirm order with status: ${status}`,
        422,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }
  }

  static validateCancel(status: string, grnCount?: number): void {
    if (status === OrderStatus.COMPLETED) {
      throw new DomainError(
        'Cannot cancel a completed order',
        422,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }

    if (status === OrderStatus.CANCELLED) {
      throw new DomainError(
        'Order is already cancelled',
        422,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }

    // Check if any goods have been received
    if (grnCount !== undefined && grnCount > 0) {
      throw new DomainError(
        'Cannot cancel order: Goods have already been received',
        422,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }
}
