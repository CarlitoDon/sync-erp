/**
 * Type for Prisma Decimal that can be number, string, or Decimal object.
 * Used across frontend to handle serialized Decimal values from tRPC.
 */
export type DecimalLike =
  | number
  | string
  | { toNumber(): number }
  | null;

/**
 * Convert DecimalLike to number.
 */
export function toNumber(value: DecimalLike | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber();
  }
  return Number(value);
}

/**
 * Format a number in compact form (e.g., 1.5M, 500K).
 */
export function formatCompact(val: number): string {
  if (val >= 1000000000) return `${(val / 1000000000).toFixed(1)}B`;
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
  return val.toFixed(0);
}
