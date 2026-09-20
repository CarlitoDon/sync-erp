/**
 * Canonical Journal Reference Constants and Builders.
 * Single source of truth for accounting journal references across Sync ERP.
 * Eliminates raw string literals in services and tests.
 */

export const JOURNAL_REF_PREFIX = {
  RENTAL_DP: 'Rental DP: ',
  RENTAL_RELEASE: 'Rental Release: ',
  RENTAL_EXTENSION: 'Rental Extension: ',
  RENTAL_DAMAGE_FEE: 'Rental Damage Fee: ',
  RENTAL_LATE_FEE: 'Rental Late Fee: ',
  RENTAL_REFUND_DP: 'Rental Refund DP: ',
  RENTAL_DEPOSIT: 'Rental Deposit: ',
  RENTAL_RETURN: 'Rental Return: ',
  // Backward compatibility alias keys:
  RENTAL_LEGACY_DEPOSIT: 'Rental Deposit: ',
  RENTAL_LEGACY_RETURN: 'Rental Return: ',
} as const;

export type JournalRefPrefixKey = keyof typeof JOURNAL_REF_PREFIX;
export type JournalRefPrefix = (typeof JOURNAL_REF_PREFIX)[JournalRefPrefixKey];

export function buildRentalDpRef(orderNumber: string): string {
  return `${JOURNAL_REF_PREFIX.RENTAL_DP}${orderNumber}`;
}

export function buildRentalReleaseRef(orderNumber: string): string {
  return `${JOURNAL_REF_PREFIX.RENTAL_RELEASE}${orderNumber}`;
}

export function buildRentalExtensionRef(
  orderNumber: string,
  extensionNumber?: number
): string {
  if (extensionNumber !== undefined && extensionNumber > 1) {
    return `Rental Extension #${extensionNumber}: ${orderNumber}`;
  }
  return `${JOURNAL_REF_PREFIX.RENTAL_EXTENSION}${orderNumber}`;
}

export function buildRentalExtensionLegacyRef(
  orderNumber: string,
  extensionNumber: number
): string {
  return `Rental Extension: ${orderNumber} (Ext #${extensionNumber})`;
}

export function buildRentalDamageFeeRef(orderNumber: string): string {
  return `${JOURNAL_REF_PREFIX.RENTAL_DAMAGE_FEE}${orderNumber}`;
}

export function buildRentalLateFeeRef(orderNumber: string): string {
  return `${JOURNAL_REF_PREFIX.RENTAL_LATE_FEE}${orderNumber}`;
}

export function buildRentalRefundDpRef(orderNumber: string): string {
  return `${JOURNAL_REF_PREFIX.RENTAL_REFUND_DP}${orderNumber}`;
}

export function buildRentalDepositRef(orderNumber: string): string {
  return `${JOURNAL_REF_PREFIX.RENTAL_DEPOSIT}${orderNumber}`;
}

export function buildRentalReturnRef(orderNumber: string): string {
  return `${JOURNAL_REF_PREFIX.RENTAL_RETURN}${orderNumber}`;
}

export const buildLegacyRentalDepositRef = buildRentalDepositRef;
export const buildLegacyRentalReturnRef = buildRentalReturnRef;

export const JournalReferences = {
  prefixes: JOURNAL_REF_PREFIX,
  rentalDp: buildRentalDpRef,
  rentalRelease: buildRentalReleaseRef,
  rentalExtension: buildRentalExtensionRef,
  rentalDamageFee: buildRentalDamageFeeRef,
  rentalLateFee: buildRentalLateFeeRef,
  rentalRefundDp: buildRentalRefundDpRef,
  legacyRentalDeposit: buildRentalDepositRef,
  legacyRentalReturn: buildRentalReturnRef,
  legacyRentalExtension: buildRentalExtensionLegacyRef,
  // Direct aliases for convenience
  rentalDeposit: buildRentalDepositRef,
  rentalReturn: buildRentalReturnRef,
  rentalExtensionLegacy: buildRentalExtensionLegacyRef,
  isRentalRelease(reference: string): boolean {
    return reference.startsWith(JOURNAL_REF_PREFIX.RENTAL_RELEASE.trim());
  },
} as const;
