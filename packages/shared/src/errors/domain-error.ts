/**
 * DomainError - Used for business rule violations.
 *
 * Thrown by Policy layer when an operation is not allowed
 * based on BusinessShape or other domain constraints.
 *
 * @example
 * throw new DomainError('Stock tracking is disabled for Service companies');
 */
export class DomainError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(
    message: string,
    statusCode: number = 400,
    code: string = 'DOMAIN_ERROR'
  ) {
    super(message);
    this.name = 'DomainError';
    this.statusCode = statusCode;
    this.code = code;

    // Maintains proper stack trace for where the error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DomainError);
    }
  }

  /**
   * Convert to JSON for API response
   */
  toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code,
    };
  }
}

// Common domain error codes
export const DomainErrorCodes = {
  SHAPE_PENDING: 'SHAPE_PENDING',
  SHAPE_ALREADY_SET: 'SHAPE_ALREADY_SET',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  MUTATION_BLOCKED: 'MUTATION_BLOCKED',
  // Invoice
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  INVOICE_ALREADY_POSTED: 'INVOICE_ALREADY_POSTED',
  INVOICE_INVALID_STATE: 'INVOICE_INVALID_STATE',
  INVOICE_HAS_PAYMENTS: 'INVOICE_HAS_PAYMENTS',
  // Bill
  BILL_NOT_FOUND: 'BILL_NOT_FOUND',
  BILL_ALREADY_POSTED: 'BILL_ALREADY_POSTED',
  BILL_INVALID_STATE: 'BILL_INVALID_STATE',
  BILL_HAS_PAYMENTS: 'BILL_HAS_PAYMENTS',
  // Order
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_ALREADY_CONFIRMED: 'ORDER_ALREADY_CONFIRMED',
  ORDER_INVALID_STATE: 'ORDER_INVALID_STATE',
  // Payment
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  PAYMENT_ALREADY_VOIDED: 'PAYMENT_ALREADY_VOIDED',
  PAYMENT_INVALID_TYPE: 'PAYMENT_INVALID_TYPE', // Feature 036
  PAYMENT_EXCEEDS_BALANCE: 'PAYMENT_EXCEEDS_BALANCE', // Feature 036
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED', // Feature 036: Upfront payment required before receive
  // General
  NOT_FOUND: 'NOT_FOUND',
  INVALID_DATE: 'INVALID_DATE',
  FEATURE_DISABLED_PHASE_1: 'FEATURE_DISABLED_PHASE_1',
  // Journal
  DUPLICATE_JOURNAL: 'DUPLICATE_JOURNAL',
} as const;
