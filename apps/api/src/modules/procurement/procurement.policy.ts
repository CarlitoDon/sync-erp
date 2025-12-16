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

/**
 * ProcurementPolicy - Shape-based constraints for procurement operations.
 */
export class ProcurementPolicy {
  /**
   * Check if purchasing physical goods is allowed.
   * SERVICE companies can only purchase services, not physical goods.
   */
  static canPurchasePhysicalGoods(shape: BusinessShape): boolean {
    return shape !== BusinessShape.SERVICE && shape !== BusinessShape.PENDING;
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
}
