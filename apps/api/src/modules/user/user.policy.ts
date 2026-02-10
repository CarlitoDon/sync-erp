/**
 * User Policy
 *
 * Enforces validation rules for user management operations.
 * All methods are stateless and unit-testable.
 *
 * Pattern: Policy.ensure*() throws DomainError if constraint violated.
 */

import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

/**
 * UserPolicy - Validation rules for user operations.
 */
export class UserPolicy {
  /**
   * Ensure user exists, throw if not found.
   */
  static ensureUserExists(user: unknown): void {
    if (!user) {
      throw new DomainError(
        'User not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }
  }

  /**
   * Ensure email is valid and not empty.
   */
  static ensureValidEmail(email: string): void {
    if (!email || email.trim().length === 0) {
      throw new DomainError(
        'User email is required',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new DomainError(
        'Invalid email format',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }

  /**
   * Ensure name is valid and not empty.
   */
  static ensureValidName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new DomainError(
        'User name is required',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }

  /**
   * Ensure user is not already assigned to company.
   */
  static ensureNotAlreadyAssigned(membership: unknown): void {
    if (membership) {
      throw new DomainError(
        'User is already assigned to this company',
        409,
        DomainErrorCodes.ALREADY_EXISTS
      );
    }
  }

  /**
   * Ensure user is assigned to company before removal.
   */
  static ensureIsAssigned(membership: unknown): void {
    if (!membership) {
      throw new DomainError(
        'User is not assigned to this company',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }
  }

  /**
   * Check if user can be removed from company.
   * Last admin cannot be removed.
   */
  static canRemoveFromCompany(
    isLastAdmin: boolean,
    isRemovingSelf: boolean
  ): boolean {
    return !isLastAdmin || !isRemovingSelf;
  }

  /**
   * Ensure user can be removed from company.
   */
  static ensureCanRemoveFromCompany(isLastAdmin: boolean): void {
    if (isLastAdmin) {
      throw new DomainError(
        'Cannot remove the last admin from company',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }
}
