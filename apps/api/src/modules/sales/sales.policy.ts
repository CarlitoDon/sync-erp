/**
 * Sales Policy
 *
 * Enforces BusinessShape constraints for sales operations.
 * All methods are stateless and unit-testable.
 *
 * Pattern: Policy.ensure*() throws DomainError if constraint violated.
 */

import { BusinessShape } from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

/**
 * SalesPolicy - Shape-based constraints for sales operations.
 */
export class SalesPolicy {
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
}
