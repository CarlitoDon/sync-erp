import { Invoice, InvoiceStatus } from '@sync-erp/database';
import { BusinessDate } from '@sync-erp/shared';
import { Decimal } from 'decimal.js';

export class BillPolicy {
  /**
   * Validate creation rules
   */
  static validateCreate(data: { businessDate?: Date }) {
    if (data.businessDate) {
      BusinessDate.from(data.businessDate).ensureValid();
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
      [key: string]: unknown;
    }
  ) {
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new Error('Cannot update bill that is not DRAFT');
    }

    // If linked to PO (orderId exists), amount is locked
    if (existing.orderId && data.amount !== undefined) {
      const newAmount = new Decimal(data.amount);
      const currentAmount = new Decimal(existing.amount);

      if (!newAmount.equals(currentAmount)) {
        throw new Error(
          'Cannot change amount of bill linked to Purchase Order'
        );
      }
    }
  }
}
