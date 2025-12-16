/**
 * Company Policy
 *
 * Enforces BusinessShape transition constraints.
 * Shape selection is ONE-TIME ONLY (immutable once set).
 *
 * Pattern: Policy.ensure*() throws DomainError if constraint violated.
 */

import { BusinessShape } from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

/**
 * CompanyPolicy - Shape transition rules.
 */
export class CompanyPolicy {
  /**
   * Check if shape selection is allowed.
   * Shape can only be selected if currently PENDING.
   */
  static canSelectShape(currentShape: BusinessShape): boolean {
    return currentShape === BusinessShape.PENDING;
  }

  /**
   * Ensure shape selection is allowed, throw if not.
   */
  static ensureCanSelectShape(currentShape: BusinessShape): void {
    if (!this.canSelectShape(currentShape)) {
      throw new DomainError(
        'Business shape cannot be changed after initial selection',
        400,
        DomainErrorCodes.SHAPE_ALREADY_SET
      );
    }
  }

  /**
   * Validate the target shape is a valid selection.
   * PENDING cannot be selected as a target shape.
   */
  static isValidTargetShape(shape: BusinessShape): boolean {
    return (
      shape === BusinessShape.RETAIL ||
      shape === BusinessShape.MANUFACTURING ||
      shape === BusinessShape.SERVICE
    );
  }

  /**
   * Ensure target shape is valid for selection.
   */
  static ensureValidTargetShape(shape: BusinessShape): void {
    if (!this.isValidTargetShape(shape)) {
      throw new DomainError(
        'Invalid target shape. Must be one of: RETAIL, MANUFACTURING, SERVICE',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }
}
