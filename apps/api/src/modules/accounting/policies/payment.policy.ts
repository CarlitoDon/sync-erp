import {
  Invoice,
  InvoiceStatus,
  PaymentMethodType,
} from '@sync-erp/database';
import {
  DomainError,
  DomainErrorCodes,
  CreatePaymentInput,
  Money,
} from '@sync-erp/shared';

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

    // Phase 1 Guard: Block Multi-Currency
    const currency =
      (invoice as typeof invoice & { currency?: string }).currency ||
      'IDR';
    Money.from(0, currency).ensureBase();

    // State Guard: Invoice must be POSTED or PARTIALLY_PAID (FR-016)
    const payableStatuses: InvoiceStatus[] = [
      InvoiceStatus.POSTED,
      InvoiceStatus.PARTIALLY_PAID,
    ];
    if (!payableStatuses.includes(invoice.status)) {
      throw new DomainError(
        `Cannot record payment: Invoice status is ${invoice.status}, must be POSTED or PARTIALLY_PAID`,
        400,
        DomainErrorCodes.INVOICE_INVALID_STATE
      );
    }

    // Amount validation: must be positive
    if (data.amount <= 0) {
      throw new DomainError(
        'Payment amount must be positive',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    // Amount validation: cannot exceed outstanding balance
    const balance = Number(invoice.balance);
    if (data.amount > balance) {
      throw new DomainError(
        `Payment amount ${data.amount} exceeds invoice balance ${balance}`,
        422,
        DomainErrorCodes.INVOICE_INVALID_STATE
      );
    }

    const validMethods = Object.values(PaymentMethodType);
    if (!validMethods.includes(data.method as PaymentMethodType)) {
      throw new DomainError(
        `Invalid payment method: ${data.method}`,
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Check if invoice is fully paid after payment
   */
  static isFullyPaid(
    currentBalance: number,
    paymentAmount: number
  ): boolean {
    return currentBalance - paymentAmount <= 0;
  }
}
