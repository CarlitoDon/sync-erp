/**
 * Partner Policy
 *
 * Enforces validation rules for partner (customer/supplier) operations.
 * All methods are stateless and unit-testable.
 *
 * Pattern: Policy.ensure*() throws DomainError if constraint violated.
 */

import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

/**
 * PartnerPolicy - Validation rules for partner operations.
 */
export class PartnerPolicy {
  /**
   * Ensure partner exists, throw if not found.
   */
  static ensurePartnerExists(partner: unknown): void {
    if (!partner) {
      throw new DomainError(
        'Partner not found',
        404,
        DomainErrorCodes.PARTNER_NOT_FOUND
      );
    }
  }

  /**
   * Ensure partner name is valid.
   */
  static ensureValidName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new DomainError(
        'Partner name is required',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }

  /**
   * Ensure partner email is valid (if provided).
   */
  static ensureValidEmail(email: string | undefined): void {
    if (email && email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new DomainError(
          'Invalid email format',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
    }
  }

  /**
   * Check if partner has no linked documents.
   * Partner with linked POs, SOs, or invoices cannot be deleted.
   */
  static canDelete(linkedDocumentsCount: number): boolean {
    return linkedDocumentsCount === 0;
  }

  /**
   * Ensure partner can be deleted.
   */
  static ensureCanDelete(linkedDocumentsCount: number): void {
    if (!this.canDelete(linkedDocumentsCount)) {
      throw new DomainError(
        'Cannot delete partner with linked documents (POs, SOs, or Invoices)',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Ensure no duplicate partner exists.
   */
  static ensureNoDuplicate(
    existingPartner: unknown,
    field: string
  ): void {
    if (existingPartner) {
      throw new DomainError(
        `Partner with this ${field} already exists`,
        409,
        DomainErrorCodes.ALREADY_EXISTS
      );
    }
  }
}
