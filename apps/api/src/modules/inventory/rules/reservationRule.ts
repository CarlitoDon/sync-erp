/**
 * Reservation Rules - Pure Business Logic
 *
 * Stateless, unit-testable functions for reservation calculations.
 * No database access, no side effects.
 */

import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

/**
 * Ensure there is enough unreserved stock for a reservation.
 *
 * @param availableQty - Total stock on hand
 * @param reservedQty - Currently reserved quantity
 * @param requestedQty - Quantity to reserve
 * @throws DomainError if cannot reserve
 */
export function ensureReservable(
  availableQty: number,
  reservedQty: number,
  requestedQty: number
): void {
  const unreservedQty = availableQty - reservedQty;
  if (requestedQty > unreservedQty) {
    throw new DomainError(
      `Cannot reserve ${requestedQty} units. Available for reservation: ${unreservedQty}`,
      400,
      DomainErrorCodes.INSUFFICIENT_STOCK
    );
  }
}

/**
 * Calculate the unreserved (free) quantity.
 */
export function calculateFreeStock(
  availableQty: number,
  reservedQty: number
): number {
  return Math.max(0, availableQty - reservedQty);
}
