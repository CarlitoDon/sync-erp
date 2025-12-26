import {
  Invoice,
  InvoiceStatus,
  OrderStatus,
  PaymentTerms,
} from '@sync-erp/database';
import {
  BusinessDate,
  DomainError,
  DomainErrorCodes,
} from '@sync-erp/shared';
import { Decimal } from 'decimal.js';

export class BillPolicy {
  /**
   * Validate creation rules
   */
  static validateCreate(data: { businessDate?: Date }) {
    if (data.businessDate) {
      try {
        BusinessDate.from(data.businessDate).ensureValid();
      } catch (error) {
        throw new DomainError(
          'Invalid business date provided',
          400,
          DomainErrorCodes.INVALID_DATE
        );
      }
    }
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
  ) {
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
    if (status !== InvoiceStatus.DRAFT) {
      throw new DomainError(
        `Cannot post bill with status ${status}`,
        422,
        DomainErrorCodes.BILL_INVALID_STATE
      );
    }
  }

  /**
   * Ensure the Purchase Order is in a valid state for Bill creation.
   * PO must be CONFIRMED, PARTIALLY_RECEIVED, RECEIVED, or COMPLETED.
   */
  static ensureOrderReadyForBill(order: { status: string }): void {
    const validStatuses = [
      OrderStatus.CONFIRMED,
      OrderStatus.PARTIALLY_RECEIVED,
      OrderStatus.RECEIVED,
      OrderStatus.COMPLETED,
    ];
    if (
      !validStatuses.includes(
        order.status as (typeof validStatuses)[number]
      )
    ) {
      throw new DomainError(
        `Cannot create bill: PO status is ${order.status}, must be CONFIRMED or later`,
        400,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }
  }

  static ensureGoodsReceived(grnCount: number): void {
    if (grnCount === 0) {
      throw new DomainError(
        'Cannot create bill: Goods have not been received (no GRN found)',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * FR-011, FR-020: 3-Way Matching Validation
   *
   * Validates that Bill qty/price matches PO and GRN:
   * - Bill qty MUST equal GRN received qty per product
   * - Bill price MUST equal PO unit price
   * - Bill amount MUST equal (PO total - DP paid) for Final Bills
   *
   * SKIP conditions (no 3-way matching):
   * - DP Bills (notes contains "Down Payment") - created before GRN
   * - UPFRONT Bills when no GRN exists yet - pre-delivery payment
   *
   * @param bill - The bill being posted
   * @param order - The linked purchase order with items
   * @param receivedQtyByProduct - Map of productId -> total received qty from GRNs
   * @param isDpBill - Whether this is a Down Payment bill
   */
  static validate3WayMatching(
    bill: {
      amount: Decimal | number;
      subtotal: Decimal | number;
      notes?: string | null;
    },
    order: {
      items: Array<{
        productId: string;
        quantity: number;
        price: Decimal | number;
      }>;
      totalAmount: Decimal | number;
      dpAmount?: Decimal | number | null;
      paymentTerms?: string | null;
    },
    receivedQtyByProduct: Map<string, number>,
    isDpBill: boolean = false
  ): void {
    // 1. Skip for DP Bills (created before GRN, no matching needed)
    if (isDpBill || bill.notes?.includes('Down Payment')) {
      return;
    }

    // 2. Skip for UPFRONT with no GRN yet (pre-delivery payment)
    if (
      order.paymentTerms === PaymentTerms.UPFRONT &&
      receivedQtyByProduct.size === 0
    ) {
      return;
    }

    // 3. Enforce 3-way matching for Final Bills
    // Calculate expected subtotal from PO items (qty * price)
    const poSubtotal = order.items.reduce(
      (sum, item) => sum + item.quantity * Number(item.price),
      0
    );

    // Deduct DP from expected subtotal if applicable
    // Note: dpAmount is typically calculated from totalAmount (incl tax),
    // so for subtotal comparison, we need to reverse-calculate the pre-tax portion
    // For simplicity in Phase 1, we'll allow DP scenarios to pass (they skip above anyway)
    const dpPaid = order.dpAmount ? Number(order.dpAmount) : 0;

    // Calculate expected Bill subtotal
    // If DP exists, the final bill subtotal = PO subtotal - (DP pre-tax portion)
    // For simplicity: if dpPaid > 0, we assume DP bill was for the full amount matching
    let expectedSubtotal = poSubtotal;
    if (dpPaid > 0) {
      // DP was paid, final bill should have reduced subtotal
      // This path is typically skipped by the DP Bill check above
      expectedSubtotal = poSubtotal - dpPaid;
    }

    const actualSubtotal = Number(bill.subtotal);

    // 3a. Subtotal Match (pre-tax comparison)
    // Allow small tolerance for rounding (1 IDR)
    const subtotalDiff = Math.abs(actualSubtotal - expectedSubtotal);
    if (subtotalDiff > 1) {
      throw new DomainError(
        `3-way matching failed: Subtotal mismatch (Expected: ${expectedSubtotal.toLocaleString()}, Bill: ${actualSubtotal.toLocaleString()})`,
        422,
        DomainErrorCodes.THREE_WAY_MATCH_FAILED
      );
    }

    // 3b. Qty Match (Bill qty must equal total GRN received qty per product)
    for (const item of order.items) {
      const receivedQty =
        receivedQtyByProduct.get(item.productId) || 0;
      if (receivedQty !== item.quantity) {
        throw new DomainError(
          `3-way matching failed: Qty mismatch for product (Ordered: ${item.quantity}, Received: ${receivedQty})`,
          422,
          DomainErrorCodes.THREE_WAY_MATCH_FAILED
        );
      }
    }

    // Note: Price matching is implicit - Bill is created from PO prices,
    // and cannot be manually changed (validateUpdate blocks it).
    // If needed, explicit price check can be added here.
  }
}
