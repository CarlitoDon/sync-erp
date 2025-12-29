/**
 * Partner Policy
 *
 * Enforces partner-related business rules.
 * Currently minimal - can be extended for partner type constraints.
 *
 * Pattern: Policy.ensure*() throws DomainError if constraint violated.
 */

import { PartnerType } from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

/**
 * PartnerPolicy - Partner validation rules.
 */
export class PartnerPolicy {
  /**
   * Ensure partner name is valid.
   */
  static ensureValidName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new DomainError(
        'Partner name is required',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Ensure partner type is valid.
   */
  static ensureValidType(type: PartnerType): void {
    if (
      type !== PartnerType.CUSTOMER &&
      type !== PartnerType.SUPPLIER
    ) {
      throw new DomainError(
        'Partner type must be CUSTOMER or SUPPLIER',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Ensure email format is valid (if provided).
   */
  static ensureValidEmail(email?: string): void {
    if (email && !email.includes('@')) {
      throw new DomainError(
        'Invalid email format',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }
}
