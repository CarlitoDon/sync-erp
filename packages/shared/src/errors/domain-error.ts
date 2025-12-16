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
} as const;
