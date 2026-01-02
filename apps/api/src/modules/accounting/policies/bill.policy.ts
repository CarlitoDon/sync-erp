/**
 * BillPolicy - P2P (Procure-to-Pay) Invoice Validation
 *
 * Domain-specific validation for Bills (supplier invoices).
 * Uses shared utilities from document-validation.utils.ts.
 */

import {
  Invoice,
  InvoiceStatus,
  OrderStatus,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { Decimal } from 'decimal.js';
import {
  validateBusinessDate,
  validateDraftStatus,
  validateOrderStatus,
  ensureFulfillmentExists,
  validate3WayMatching,
  type ThreeWayMatchDocument,
  type ThreeWayMatchOrder,
} from '../../common/utils/document-validation.utils';

// Valid PO statuses for Bill creation
const VALID_PO_STATUSES = [
  OrderStatus.CONFIRMED,
  OrderStatus.PARTIALLY_RECEIVED,
  OrderStatus.RECEIVED,
  OrderStatus.COMPLETED,
];

export class BillPolicy {
  /**
   * Validate creation rules
   */
  static validateCreate(data: { businessDate?: Date }): void {
    validateBusinessDate(data.businessDate);
  }

  /**
   * Validate update rules
   * - State Guard: Must be DRAFT
   * - PO Link Guard: Cannot change amount if linked to PO
   */
  static validateUpdate(
    existing: Invoice,
    data: {
      amount?: Decimal | number | string;
      memo?: string;
    }
  ): void {
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new DomainError(
        'Bill is not in the correct state for this action',
        422,
        DomainErrorCodes.BILL_INVALID_STATE
      );
    }

    // If linked to PO (orderId exists), amount is locked
    if (existing.orderId && data.amount !== undefined) {
      const newAmount = new Decimal(data.amount);
      const currentAmount = new Decimal(existing.amount);

      if (!newAmount.equals(currentAmount)) {
        throw new DomainError(
          'Cannot change amount of bill linked to Purchase Order',
          400,
          DomainErrorCodes.MUTATION_BLOCKED
        );
      }
    }
  }

  /**
   * Validate bill can be posted (must be DRAFT)
   */
  static validatePost(status: string): void {
    validateDraftStatus(
      status,
      'Bill',
      DomainErrorCodes.BILL_INVALID_STATE
    );
  }

  /**
   * Ensure PO is in valid state for Bill creation
   */
  static ensureOrderReadyForBill(order: { status: string }): void {
    validateOrderStatus(
      order.status,
      VALID_PO_STATUSES,
      'Bill',
      'PO'
    );
  }

  /**
   * Ensure GRN exists before Bill creation
   */
  static ensureGoodsReceived(grnCount: number): void {
    ensureFulfillmentExists(grnCount, 'Bill', 'GRN');
  }

  /**
   * FR-011, FR-020: 3-Way Matching Validation
   *
   * Validates that Bill qty/price matches PO and GRN.
   */
  static validate3WayMatching(
    bill: ThreeWayMatchDocument,
    order: ThreeWayMatchOrder,
    receivedQtyByProduct: Map<string, number>,
    isDpBill: boolean = false
  ): void {
    validate3WayMatching(
      bill,
      order,
      receivedQtyByProduct,
      'Bill',
      'Received',
      isDpBill
    );
  }

  /**
   * Feature 041: Validate not over-billing
   * Prevents creating bills whose subtotal exceeds remaining unbilled order value.
   * Note: DP is NOT subtracted here because DP is a pre-payment mechanism,
   * not a restriction on what can be billed. The DP deduction is applied
   * in the bill amount calculation, not in this validation.
   */
  static validateNotOverBilling(
    newBillSubtotal: Decimal,
    existingBilledTotal: Decimal,
    orderSubtotal: Decimal
  ): void {
    const maxBillable = orderSubtotal.minus(existingBilledTotal);
    // Allow 1 IDR tolerance for rounding
    if (newBillSubtotal.greaterThan(maxBillable.plus(1))) {
      throw new DomainError(
        `Bill subtotal (${newBillSubtotal.toFixed(0)}) exceeds remaining unbilled value. Max billable: ${maxBillable.toFixed(0)}`,
        400,
        DomainErrorCodes.EXCEEDS_ORDER_VALUE
      );
    }
  }

  /**
   * Feature 041: Validate fulfillment not already invoiced
   * Prevents billing the same GRN twice (unless previous bill was voided).
   */
  static validateFulfillmentNotInvoiced(fulfillment: {
    invoices?: { id: string; status: InvoiceStatus }[];
  }): void {
    // Filter out VOID invoices - allow re-billing if all linked invoices are voided
    const activeInvoices =
      fulfillment.invoices?.filter(
        (inv) => inv.status !== InvoiceStatus.VOID
      ) || [];

    if (activeInvoices.length > 0) {
      throw new DomainError(
        'This GRN already has a bill linked to it',
        400,
        DomainErrorCodes.FULFILLMENT_ALREADY_INVOICED
      );
    }
  }
}
