/**
 * Admin Policy
 *
 * Enforces access control and validation for admin operations.
 * All methods are stateless and unit-testable.
 *
 * Pattern: Policy.ensure*() throws DomainError if constraint violated.
 */

import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

/**
 * AdminPolicy - Access control for admin observability operations.
 */
export class AdminPolicy {
  /**
   * Ensure user has admin access to company.
   */
  static ensureAdminAccess(
    userRole: string | undefined,
    requiredRoles: string[] = ['ADMIN', 'OWNER']
  ): void {
    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new DomainError(
        'Admin access required for this operation',
        403,
        DomainErrorCodes.FORBIDDEN
      );
    }
  }

  /**
   * Validate pagination parameters.
   */
  static ensureValidPagination(limit: number, offset: number): void {
    if (limit < 1 || limit > 100) {
      throw new DomainError(
        'Limit must be between 1 and 100',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
    if (offset < 0) {
      throw new DomainError(
        'Offset must be non-negative',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }

  /**
   * Ensure saga step filter is valid.
   */
  static ensureValidSagaStep(
    step: string | undefined,
    validSteps: string[] = [
      'FAILED',
      'COMPENSATED',
      'COMPENSATION_FAILED',
    ]
  ): void {
    if (step && !validSteps.includes(step)) {
      throw new DomainError(
        `Invalid saga step. Must be one of: ${validSteps.join(', ')}`,
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }

  /**
   * Check if user can view sensitive audit data.
   */
  static canViewAuditData(userRole: string | undefined): boolean {
    return userRole === 'ADMIN' || userRole === 'OWNER';
  }

  /**
   * Ensure user can view audit data.
   */
  static ensureCanViewAuditData(userRole: string | undefined): void {
    if (!this.canViewAuditData(userRole)) {
      throw new DomainError(
        'Permission denied. Admin or Owner role required.',
        403,
        DomainErrorCodes.FORBIDDEN
      );
    }
  }
}
