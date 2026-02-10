/**
 * Cash Bank Policy
 *
 * Enforces validation rules for cash/bank transactions.
 * All methods are stateless and unit-testable.
 *
 * Pattern: Policy.ensure*() throws DomainError if constraint violated.
 */

import { CashTransactionStatus } from '@sync-erp/database';
import {
  DomainError,
  DomainErrorCodes,
  CreateCashTransactionInput,
} from '@sync-erp/shared';

/**
 * CashBankPolicy - Validation rules for cash/bank operations.
 */
export class CashBankPolicy {
  /**
   * Check if a transaction can be posted.
   * Only DRAFT transactions can be posted.
   */
  static canPostTransaction(status: CashTransactionStatus): boolean {
    return status === CashTransactionStatus.DRAFT;
  }

  /**
   * Ensure transaction can be posted, throw if not.
   */
  static ensureCanPostTransaction(
    status: CashTransactionStatus
  ): void {
    if (!this.canPostTransaction(status)) {
      throw new DomainError(
        'Only DRAFT transactions can be posted',
        400,
        DomainErrorCodes.INVALID_STATE_TRANSITION
      );
    }
  }

  /**
   * Check if a transaction can be voided.
   * Only POSTED transactions can be voided.
   */
  static canVoidTransaction(status: CashTransactionStatus): boolean {
    return status === CashTransactionStatus.POSTED;
  }

  /**
   * Ensure transaction can be voided, throw if not.
   */
  static ensureCanVoidTransaction(
    status: CashTransactionStatus
  ): void {
    if (!this.canVoidTransaction(status)) {
      throw new DomainError(
        'Only POSTED transactions can be voided',
        400,
        DomainErrorCodes.INVALID_STATE_TRANSITION
      );
    }
  }

  /**
   * Ensure void reason is provided and valid.
   */
  static ensureValidVoidReason(reason: string | undefined): void {
    if (!reason || reason.trim().length === 0) {
      throw new DomainError(
        'Void reason is required',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }

  /**
   * Validate SPEND transaction requirements.
   */
  static ensureValidSpendTransaction(
    sourceBankAccountId?: string | null,
    destinationBankAccountId?: string | null,
    itemsCount?: number
  ): void {
    if (!sourceBankAccountId) {
      throw new DomainError(
        'Source bank account is required for SPEND transactions',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
    if (destinationBankAccountId) {
      throw new DomainError(
        'Destination bank account must be empty for SPEND transactions',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
    if (!itemsCount || itemsCount === 0) {
      throw new DomainError(
        'Expense items are required for SPEND transactions',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }

  /**
   * Validate RECEIVE transaction requirements.
   */
  static ensureValidReceiveTransaction(
    sourceBankAccountId?: string | null,
    destinationBankAccountId?: string | null,
    itemsCount?: number
  ): void {
    if (!destinationBankAccountId) {
      throw new DomainError(
        'Destination bank account is required for RECEIVE transactions',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
    if (sourceBankAccountId) {
      throw new DomainError(
        'Source bank account must be empty for RECEIVE transactions',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
    if (!itemsCount || itemsCount === 0) {
      throw new DomainError(
        'Income items are required for RECEIVE transactions',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }

  /**
   * Validate TRANSFER transaction requirements.
   */
  static ensureValidTransferTransaction(
    sourceBankAccountId?: string | null,
    destinationBankAccountId?: string | null,
    amount?: number
  ): void {
    if (!sourceBankAccountId || !destinationBankAccountId) {
      throw new DomainError(
        'Both source and destination accounts are required for TRANSFER',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
    if (sourceBankAccountId === destinationBankAccountId) {
      throw new DomainError(
        'Source and destination accounts must be different',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
    if (!amount || amount <= 0) {
      throw new DomainError(
        'A positive amount is required for TRANSFER',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }
  /**
   * Ensure transaction is in valid state for update.
   */
  static ensureCanUpdateTransaction(
    status: CashTransactionStatus
  ): void {
    if (status !== CashTransactionStatus.DRAFT) {
      throw new DomainError(
        'Only DRAFT transactions can be updated',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Validate transaction creation input.
   */
  static ensureValidCreateInput(
    data: CreateCashTransactionInput
  ): void {
    if (data.type === 'SPEND') {
      this.ensureValidSpendTransaction(
        data.sourceBankAccountId,
        data.destinationBankAccountId,
        data.items?.length
      );
    } else if (data.type === 'RECEIVE') {
      this.ensureValidReceiveTransaction(
        data.sourceBankAccountId,
        data.destinationBankAccountId,
        data.items?.length
      );
    } else if (data.type === 'TRANSFER') {
      this.ensureValidTransferTransaction(
        data.sourceBankAccountId,
        data.destinationBankAccountId,
        data.amount
      );
    }
  }
}
