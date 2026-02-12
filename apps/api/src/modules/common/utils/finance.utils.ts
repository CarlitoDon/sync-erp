/**
 * Shared finance utility functions.
 * Extracted to reduce duplication across bill/invoice services.
 */

/**
 * Normalize tax rate to a decimal multiplier.
 * Handles both percentage (e.g., 11) and decimal (e.g., 0.11) formats.
 *
 * @param rate - Tax rate (can be percentage like 11 or decimal like 0.11)
 * @returns Decimal multiplier (e.g., 0.11)
 *
 * @example
 * normalizeTaxRate(11)   // 0.11
 * normalizeTaxRate(0.11) // 0.11
 * normalizeTaxRate(0)    // 0
 */
export function normalizeTaxRate(rate: number): number {
  return rate > 1 ? rate / 100 : rate;
}
