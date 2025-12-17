import { Invoice, InvoiceStatus } from '@sync-erp/database';
import {
  BusinessDate,
  DomainError,
  DomainErrorCodes,
} from '@sync-erp/shared';

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
      throw new DomainError(
        'Invoice is not in the correct state for this action',
        422,
        DomainErrorCodes.INVOICE_INVALID_STATE
      );
    }

    if (
      data.invoiceNumber &&
      data.invoiceNumber !== existing.invoiceNumber
    ) {
      throw new DomainError(
        'Invoice number cannot be changed',
        400,
        DomainErrorCodes.MUTATION_BLOCKED
      );
    }
  }
}
