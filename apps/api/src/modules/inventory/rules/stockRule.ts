/**
 * Stock Rules - Pure Business Logic
 *
 * Stateless, unit-testable functions for stock calculations.
 * No database access, no side effects.
 */

import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

/**
 * Ensure there is enough available stock for an operation.
 * @throws DomainError if insufficient stock
 */
export function ensureAvailableStock(
  availableQty: number,
  requestedQty: number,
  productName?: string
): void {
  if (requestedQty > availableQty) {
    const product = productName ? ` for "${productName}"` : '';
    throw new DomainError(
      `Insufficient stock${product}. Available: ${availableQty}, Requested: ${requestedQty}`,
      400,
      DomainErrorCodes.INSUFFICIENT_STOCK
    );
  }
}

// Re-export pure cost calculation formulas from @sync-erp/shared
export { calculateNewAvgCost, calculateHPP_AVG } from '@sync-erp/shared';

/**
 * Validate stock adjustment quantity.
 * Negative adjustments are allowed for corrections.
 *
 * @throws DomainError if adjustment would result in negative stock
 */
export function validateStockAdjustment(
  currentQty: number,
  adjustmentQty: number,
  allowNegative: boolean = false
): void {
  const resultingQty = currentQty + adjustmentQty;
  if (!allowNegative && resultingQty < 0) {
    throw new DomainError(
      `Stock adjustment would result in negative stock. Current: ${currentQty}, Adjustment: ${adjustmentQty}`,
      400,
      DomainErrorCodes.INSUFFICIENT_STOCK
    );
  }
}
