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

/**
 * Calculate new weighted average cost after stock receipt.
 *
 * Formula: new_avg = ((old_qty × old_avg) + (in_qty × in_price)) / total_qty
 *
 * @param oldQty - Current stock quantity
 * @param oldAvgCost - Current average cost per unit
 * @param inQty - Incoming quantity
 * @param inUnitCost - Cost per unit of incoming stock
 * @returns New weighted average cost
 */
export function calculateNewAvgCost(
  oldQty: number,
  oldAvgCost: number,
  inQty: number,
  inUnitCost: number
): number {
  const totalQty = oldQty + inQty;
  if (totalQty === 0) return 0;

  const totalValue = oldQty * oldAvgCost + inQty * inUnitCost;
  return totalValue / totalQty;
}

/**
 * Calculate Cost of Goods Sold (HPP) using Average Cost method.
 *
 * @param quantity - Quantity sold
 * @param avgCost - Average cost per unit
 * @returns Total cost of goods sold
 */
export function calculateHPP_AVG(
  quantity: number,
  avgCost: number
): number {
  return quantity * avgCost;
}

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
