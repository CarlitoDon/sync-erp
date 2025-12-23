/**
 * Procurement Policy
 *
 * Enforces BusinessShape constraints for procurement operations.
 * Mirror of SalesPolicy for Modular Parity (Constitution Principle X).
 *
 * Pattern: Policy.ensure*() throws DomainError if constraint violated.
 */

import {
  BusinessShape,
  OrderStatus,
  PaymentTerms,
  PaymentStatus,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

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

  // ==========================================
  // Feature 036: Cash Upfront Payment
  // ==========================================

  /**
   * T026: Validate PO can accept upfront payment registration.
   * - PO must exist and be CONFIRMED or later (not DRAFT/CANCELLED)
   * - PO must have paymentTerms = UPFRONT
   */
  static ensureCanRegisterPayment(order: {
    status: OrderStatus;
    paymentTerms: PaymentTerms;
    paymentStatus?: PaymentStatus | null;
  }): void {
    // Must be at least CONFIRMED
    if (
      order.status === OrderStatus.DRAFT ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new DomainError(
        `Cannot register payment for order with status: ${order.status}`,
        422,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }

    // Must be UPFRONT payment terms
    if (order.paymentTerms !== PaymentTerms.UPFRONT) {
      throw new DomainError(
        'Payment registration only allowed for UPFRONT payment terms',
        400,
        DomainErrorCodes.PAYMENT_INVALID_TYPE
      );
    }

    // Cannot register more payments if already settled
    if (order.paymentStatus === PaymentStatus.SETTLED) {
      throw new DomainError(
        'Cannot register payment: Order prepaid is already settled',
        422,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }
  }

  /**
   * T027: Validate payment amount doesn't exceed remaining balance.
   * FR-005: payment.amount <= PO.totalAmount - alreadyPaidAmount
   */
  static ensurePaymentWithinLimit(
    order: {
      totalAmount: number | { toNumber: () => number };
      paidAmount: number | { toNumber: () => number };
    },
    paymentAmount: number
  ): void {
    const totalAmount =
      typeof order.totalAmount === 'object'
        ? order.totalAmount.toNumber()
        : order.totalAmount;
    const paidAmount =
      typeof order.paidAmount === 'object'
        ? order.paidAmount.toNumber()
        : order.paidAmount;

    const remaining = totalAmount - paidAmount;

    if (paymentAmount <= 0) {
      throw new DomainError(
        'Payment amount must be positive',
        400,
        DomainErrorCodes.PAYMENT_EXCEEDS_BALANCE
      );
    }

    if (paymentAmount > remaining) {
      throw new DomainError(
        `Payment amount (${paymentAmount}) exceeds remaining balance (${remaining})`,
        400,
        DomainErrorCodes.PAYMENT_EXCEEDS_BALANCE
      );
    }
  }
}
