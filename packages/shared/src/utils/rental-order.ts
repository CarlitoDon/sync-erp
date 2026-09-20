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
