/**
 * Product Policy
 *
 * Enforces validation rules for product operations.
 * All methods are stateless and unit-testable.
 *
 * Pattern: Policy.ensure*() throws DomainError if constraint violated.
 */

import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

/**
 * ProductPolicy - Validation rules for product operations.
 */
export class ProductPolicy {
  /**
   * Ensure product exists, throw if not found.
   */
  static ensureProductExists(
    product: unknown,
    productId?: string
  ): void {
    if (!product) {
      throw new DomainError(
        productId
          ? `Product ${productId} not found`
          : 'Product not found',
        404,
        DomainErrorCodes.PRODUCT_NOT_FOUND
      );
    }
  }

  /**
   * Ensure SKU is valid and not empty.
   */
  static ensureValidSku(sku: string): void {
    if (!sku || sku.trim().length === 0) {
      throw new DomainError(
        'Product SKU is required',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }

  /**
   * Ensure product name is valid.
   */
  static ensureValidName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new DomainError(
        'Product name is required',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }

  /**
   * Ensure price is valid (non-negative).
   */
  static ensureValidPrice(price: number): void {
    if (price < 0) {
      throw new DomainError(
        'Product price cannot be negative',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }

  /**
   * Ensure sufficient stock for operation.
   */
  static ensureSufficientStock(
    availableQty: number,
    requiredQty: number,
    productName?: string
  ): void {
    if (availableQty < requiredQty) {
      throw new DomainError(
        productName
          ? `Insufficient stock for "${productName}": required ${requiredQty}, available ${availableQty}`
          : 'Insufficient stock',
        422,
        DomainErrorCodes.INSUFFICIENT_STOCK
      );
    }
  }

  /**
   * Ensure SKU is unique within company.
   */
  static ensureSkuUnique(existingProduct: unknown): void {
    if (existingProduct) {
      throw new DomainError(
        'Product with this SKU already exists',
        409,
        DomainErrorCodes.ALREADY_EXISTS
      );
    }
  }

  /**
   * Check if product can be deleted.
   * Products with stock cannot be deleted.
   */
  static canDelete(stockQty: number): boolean {
    return stockQty === 0;
  }

  /**
   * Ensure product can be deleted.
   */
  static ensureCanDelete(stockQty: number): void {
    if (!this.canDelete(stockQty)) {
      throw new DomainError(
        'Cannot delete product with existing stock. Adjust stock to zero first.',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }
}
