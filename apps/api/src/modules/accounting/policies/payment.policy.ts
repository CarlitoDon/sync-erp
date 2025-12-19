import {
  Invoice,
  InvoiceStatus,
  PaymentMethod,
} from '@sync-erp/database';
import {
  DomainError,
  DomainErrorCodes,
  CreatePaymentInput,
} from '@sync-erp/shared';
import { Decimal } from 'decimal.js';

export class PaymentPolicy {
  /**
   * Validate payment creation rules
   * - Invoice must exist and belong to company
   * - Invoice must be POSTED (not DRAFT, VOID, or PAID)
   * - Payment amount must be positive and ≤ outstanding balance
   * - Payment method must be valid
   */
  static validateCreate(
    invoice: Invoice | null,
    data: CreatePaymentInput,
    companyId: string
  ): void {
    // Invoice existence check
    if (!invoice) {
      throw new DomainError(
        'Invoice not found',
        404,
        DomainErrorCodes.INVOICE_NOT_FOUND
      );
    }

    // Company ownership check
    if (invoice.companyId !== companyId) {
      throw new DomainError(
        'Invoice does not belong to this company',
        403,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    // State Guard: Invoice must be POSTED
    if (invoice.status !== InvoiceStatus.POSTED) {
      throw new DomainError(
        `Cannot record payment: Invoice status is ${invoice.status}, must be POSTED`,
        400,
        DomainErrorCodes.INVOICE_INVALID_STATE
      );
    }

    // Amount validation: must be positive
    const amount = new Decimal(data.amount);
    if (amount.lte(0)) {
      throw new DomainError(
        'Payment amount must be positive',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    // Amount validation: cannot exceed outstanding balance
    const balance = new Decimal(invoice.balance);
    if (amount.gt(balance)) {
      throw new DomainError(
        `Payment amount (${amount.toString()}) exceeds outstanding balance (${balance.toString()})`,
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    // Payment method validation (enum check)
    const validMethods = Object.values(PaymentMethod);
    if (!validMethods.includes(data.method as PaymentMethod)) {
      throw new DomainError(
        `Invalid payment method: ${data.method}`,
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Check if invoice is fully paid
   */
  static isFullyPaid(
    invoice: Invoice,
    paymentAmount: Decimal
  ): boolean {
    const newBalance = new Decimal(invoice.balance).minus(
      paymentAmount
    );
    return newBalance.lte(0);
  }
}
