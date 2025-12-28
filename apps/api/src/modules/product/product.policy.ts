/**
 * Product Policy
 *
 * Enforces product-related business rules.
 * Currently minimal - can be extended for product type constraints.
 *
 * Pattern: Policy.ensure*() throws DomainError if constraint violated.
 */

import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

/**
 * ProductPolicy - Product validation rules.
 */
export class ProductPolicy {
  /**
   * Ensure product name is valid.
   */
  static ensureValidName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new DomainError(
        'Product name is required',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Ensure SKU is valid.
   */
  static ensureValidSku(sku: string): void {
    if (!sku || sku.trim().length === 0) {
      throw new DomainError(
        'Product SKU is required',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Ensure price is non-negative.
   */
  static ensureValidPrice(price: number): void {
    if (price < 0) {
      throw new DomainError(
        'Product price cannot be negative',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Ensure stock quantity is non-negative.
   */
  static ensureValidStock(quantity: number): void {
    if (quantity < 0) {
      throw new DomainError(
        'Stock quantity cannot be negative',
        400,
        DomainErrorCodes.INSUFFICIENT_STOCK
      );
    }
  }
}
