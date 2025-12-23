/**
 * Sales Policy
 *
 * Enforces BusinessShape constraints for sales operations.
 * Mirror of PurchaseOrderPolicy for Modular Parity (Constitution Principle X).
 *
 * Pattern: Policy.ensure*() throws DomainError if constraint violated.
 */

import { BusinessShape, OrderStatus } from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

/**
 * SalesOrderPolicy - Shape-based constraints and Status Guards.
 */
export class SalesOrderPolicy {
  /**
   * Check if selling physical goods is allowed.
   * SERVICE companies can only sell services, not physical goods.
   */
  static canSellPhysicalGoods(shape: BusinessShape): boolean {
    return (
      shape !== BusinessShape.SERVICE &&
      shape !== BusinessShape.PENDING
    );
  }

  /**
   * Ensure selling physical goods is allowed, throw if not.
   */
  static ensureCanSellPhysicalGoods(shape: BusinessShape): void {
    if (shape === BusinessShape.PENDING) {
      throw new DomainError(
        'Operations blocked until business shape is selected',
        400,
        DomainErrorCodes.SHAPE_PENDING
      );
    }

    if (!this.canSellPhysicalGoods(shape)) {
      throw new DomainError(
        'Service companies can only sell services, not physical goods',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Check if sales orders are allowed.
   * All shapes except PENDING can create sales orders.
   */
  static canCreateSalesOrder(shape: BusinessShape): boolean {
    return shape !== BusinessShape.PENDING;
  }

  /**
   * Ensure sales order creation is allowed.
   */
  static ensureCanCreateSalesOrder(shape: BusinessShape): void {
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

  /**
   * Validate confirm rules - must be DRAFT
   */
  static validateConfirm(status: string): void {
    if (status !== OrderStatus.DRAFT) {
      throw new DomainError(
        `Cannot confirm order with status: ${status}`,
        422,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }
  }

  /**
   * Validate cancel rules
   * - Cannot cancel COMPLETED orders
   * - Cannot cancel if already CANCELLED
   * - Cannot cancel if shipments exist
   */
  static validateCancel(
    status: string,
    shipmentCount?: number
  ): void {
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

    // Check if any shipments have been created
    if (shipmentCount !== undefined && shipmentCount > 0) {
      throw new DomainError(
        'Cannot cancel order: Shipments have already been created',
        422,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }
}
