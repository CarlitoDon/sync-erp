import { Invoice, InvoiceStatus } from '@sync-erp/database';
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
   * Ensure the Purchase Order is in a valid state for Bill creation.
   * PO must be CONFIRMED, RECEIVED, or COMPLETED.
   */
  static ensureOrderReadyForBill(order: { status: string }): void {
    const validStatuses = ['CONFIRMED', 'RECEIVED', 'COMPLETED'];
    if (!validStatuses.includes(order.status)) {
      throw new DomainError(
        `Cannot create bill: PO status is ${order.status}, must be CONFIRMED or later`,
        400,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }
  }

  /**
   * Ensure goods have been received (GRN exists) before creating Bill.
   * This enforces the flow: PO → GRN → Bill
   */
  static ensureGoodsReceived(grnCount: number): void {
    if (grnCount === 0) {
      throw new DomainError(
        'Cannot create bill: Goods have not been received (no GRN found)',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }
}
