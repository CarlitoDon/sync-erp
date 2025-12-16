// Saga Errors - Custom error types for saga operations

/**
 * Base error class for domain errors
 */
export class DomainError extends Error {
  code: string = 'DOMAIN_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

/**
 * Saga failed but was compensated successfully
 * The operation was rolled back - no data inconsistency
 */
export class SagaCompensatedError extends DomainError {
  public readonly sagaLogId: string;
  public readonly originalError: Error;

  constructor(sagaLogId: string, originalError: Error) {
    super(
      `Saga failed and was compensated: ${originalError.message}`
    );
    this.name = 'SagaCompensatedError';
    this.code = 'SAGA_COMPENSATED';
    this.sagaLogId = sagaLogId;
    this.originalError = originalError;
  }
}

/**
 * Saga failed AND compensation failed
 * CRITICAL: Data may be inconsistent, needs manual intervention
 */
export class SagaCompensationFailedError extends DomainError {
  public readonly sagaLogId: string;
  public readonly originalError: Error;
  public readonly compensationError: Error;

  constructor(
    sagaLogId: string,
    originalError: Error,
    compensationError: Error
  ) {
    super(
      `Saga compensation failed! Manual intervention required. ` +
        `Original: ${originalError.message}, Compensation: ${compensationError.message}`
    );
    this.name = 'SagaCompensationFailedError';
    this.code = 'SAGA_COMPENSATION_FAILED';
    this.sagaLogId = sagaLogId;
    this.originalError = originalError;
    this.compensationError = compensationError;
  }
}
