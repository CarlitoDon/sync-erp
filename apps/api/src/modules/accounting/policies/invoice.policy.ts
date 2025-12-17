import { Invoice, InvoiceStatus } from '@sync-erp/database';
import { BusinessDate } from '@sync-erp/shared';

export class InvoicePolicy {
  /**
   * Validate creation rules
   */
  static validateCreate(data: {
    businessDate?: Date;
    invoiceNumber?: string;
  }) {
    if (data.businessDate) {
      BusinessDate.from(data.businessDate).ensureValid();
    }
  }

  /**
   * Validate update rules
   * - Immutable fields: invoiceNumber
   * - State Guard: Must be DRAFT
   */
  static validateUpdate(
    existing: Invoice,
    data: { invoiceNumber?: string; [key: string]: unknown }
  ) {
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new Error('Cannot update invoice that is not DRAFT');
    }

    if (
      data.invoiceNumber &&
      data.invoiceNumber !== existing.invoiceNumber
    ) {
      throw new Error('Invoice number cannot be changed');
    }
  }
}
