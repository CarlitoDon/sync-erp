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
      [key: string]: unknown;
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
}
