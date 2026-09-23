import { DomainError, DomainErrorCodes } from '../errors/domain-error.js';

/**
 * Domain assertion to require a valid, non-empty orderNumber on a rental order.
 * Replaces risky `order.orderNumber!` non-null assertions across fulfillment,
 * lifecycle, return, and payment services.
 *
 * @param order Object containing optional orderNumber and optional id
 * @param context Optional operation context string (e.g. "Rental DP Journal Posting")
 * @returns Non-empty trimmed orderNumber
 * @throws DomainError if order is null/undefined or orderNumber is missing/blank
 */
export function requireOrderNumber(
  order: { orderNumber?: string | null; id?: string } | null | undefined,
  context?: string
): string {
  const orderNumber = order?.orderNumber?.trim();
  if (!orderNumber) {
    const idInfo = order?.id ? ` (orderId: ${order.id})` : '';
    throw new DomainError(
      context
        ? `Order number is required for ${context}${idInfo}`
        : `Order number is required${idInfo}`,
      400,
      DomainErrorCodes.INVALID_INPUT
    );
  }
  return orderNumber;
}

/**
 * Type assertion guard that narrows an order-like object to have a guaranteed string orderNumber.
 */
export function assertHasOrderNumber<
  T extends { orderNumber?: string | null; id?: string },
>(
  order: T | null | undefined,
  context?: string
): asserts order is T & { orderNumber: string } {
  requireOrderNumber(order, context);
}

/**
 * Calculate rental duration in calendar days between two dates.
 * Santi Living / Sync ERP rental duration is strictly based on calendar day difference.
 * Minimum duration is 1 day.
 *
 * @param startDate Rental start date/timestamp
 * @param endDate Rental end date/timestamp
 * @returns Number of rental days (integer >= 1)
 */
export function calculateRentalDays(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined
): number {
  if (!startDate || !endDate) return 0;

  // Handle YYYY-MM-DD string inputs directly without timezone distortion
  if (
    typeof startDate === 'string' &&
    typeof endDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(endDate)
  ) {
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [ey, em, ed] = endDate.split('-').map(Number);
    const startUtc = Date.UTC(sy, sm - 1, sd);
    const endUtc = Date.UTC(ey, em - 1, ed);
    const diff = Math.round((endUtc - startUtc) / 86400000);
    return Math.max(1, diff);
  }

  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  // Use UTC year, month, date to normalize time-of-day offsets
  const startUtc = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate()
  );
  const endUtc = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate()
  );

  const diff = Math.round((endUtc - startUtc) / 86400000);
  return Math.max(1, diff);
}

