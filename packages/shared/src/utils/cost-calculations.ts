/**
 * Cost Calculations - Pure Domain Functions
 *
 * Stateless, unit-testable functions for inventory cost accounting.
 */

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
