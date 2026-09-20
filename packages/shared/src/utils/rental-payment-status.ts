import {
  RentalOrderStatus,
  RentalPaymentStatus,
} from '../validators/rental.js';

/**
 * Canonical payment evaluation status for rental orders across Sync ERP.
 * Single source of truth unifying frontend displays, badges, and filters.
 */
export type CanonicalPaymentStatus =
  | 'LUNAS'
  | 'MENUNGGU_VERIFIKASI'
  | 'GAGAL'
  | 'DP_TERBAYAR'
  | 'BELUM_BAYAR';

export const CanonicalPaymentStatuses: Record<
  CanonicalPaymentStatus,
  CanonicalPaymentStatus
> = {
  LUNAS: 'LUNAS',
  MENUNGGU_VERIFIKASI: 'MENUNGGU_VERIFIKASI',
  GAGAL: 'GAGAL',
  DP_TERBAYAR: 'DP_TERBAYAR',
  BELUM_BAYAR: 'BELUM_BAYAR',
} as const;

export type PaymentBadgeVariant =
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'secondary';

export const CANONICAL_PAYMENT_LABELS: Record<
  CanonicalPaymentStatus,
  string
> = {
  LUNAS: 'Lunas',
  MENUNGGU_VERIFIKASI: 'Menunggu Verifikasi',
  GAGAL: 'Gagal',
  DP_TERBAYAR: 'DP Terbayar',
  BELUM_BAYAR: 'Belum Bayar',
} as const;

export const CANONICAL_PAYMENT_BADGE_VARIANTS: Record<
  CanonicalPaymentStatus,
  PaymentBadgeVariant
> = {
  LUNAS: 'success',
  MENUNGGU_VERIFIKASI: 'warning',
  GAGAL: 'destructive',
  DP_TERBAYAR: 'warning',
  BELUM_BAYAR: 'secondary',
} as const;

export const CANONICAL_PAYMENT_BADGE_CLASSES: Record<
  CanonicalPaymentStatus,
  string
> = {
  LUNAS: 'bg-green-100 text-green-800',
  MENUNGGU_VERIFIKASI: 'bg-yellow-100 text-yellow-800',
  GAGAL: 'bg-red-100 text-red-800',
  DP_TERBAYAR: 'bg-amber-100 text-amber-800',
  BELUM_BAYAR: 'bg-gray-100 text-gray-700',
} as const;

/**
 * Generic representation of Prisma Decimal, Decimal.js, or serialized numeric fields.
 */
export type DecimalLike =
  | number
  | string
  | { toNumber(): number }
  | { toString(): string }
  | null
  | undefined;

/**
 * Minimal order shape required for payment status evaluation.
 */
export interface RentalPaymentStatusInput {
  status: string;
  rentalPaymentStatus?: string | null;
  totalAmount?: DecimalLike;
  depositAmount?: DecimalLike;
}

/**
 * Comprehensive result of rental payment status evaluation.
 */
export interface RentalPaymentStatusInfo {
  status: CanonicalPaymentStatus;
  label: string;
  badgeVariant: PaymentBadgeVariant;
  badgeClass: string;
  isLunas: boolean;
  hasDownPayment: boolean;
  depositAmount: number;
  totalAmount: number;
  remainingAmount: number;
}

function isNumberLikeObject(val: unknown): val is { toNumber(): number } {
  return (
    typeof val === 'object' &&
    val !== null &&
    'toNumber' in val &&
    typeof (val as { toNumber: unknown }).toNumber === 'function'
  );
}

function isStringLikeObject(val: unknown): val is { toString(): string } {
  return (
    typeof val === 'object' &&
    val !== null &&
    'toString' in val &&
    typeof (val as { toString: unknown }).toString === 'function'
  );
}

/**
 * Safely parse Decimal, Decimal.js, string, or number to a finite JavaScript number.
 * Returns 0 for invalid, null, or negative-NaN values.
 */
export function parseNumberLike(val: unknown): number {
  if (val === null || val === undefined) {
    return 0;
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : 0;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (isNumberLikeObject(val)) {
    try {
      const num = val.toNumber();
      return typeof num === 'number' && Number.isFinite(num) ? num : 0;
    } catch {
      return 0;
    }
  }
  if (isStringLikeObject(val)) {
    try {
      const str = val.toString();
      const num = Number(str);
      return Number.isFinite(num) ? num : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

/**
 * Evaluates the canonical payment status of a rental order.
 *
 * Rules:
 * 1. Order is LUNAS if:
 *    - order.status === COMPLETED (order completed & settled), OR
 *    - order.rentalPaymentStatus === CONFIRMED (explicitly confirmed by admin/fulfillment), OR
 *    - order.status !== DRAFT AND depositAmount >= totalAmount AND totalAmount > 0 (100% upfront deposit paid).
 *
 * 2. Order is MENUNGGU_VERIFIKASI if:
 *    - order.rentalPaymentStatus === AWAITING_CONFIRM (customer claimed payment, waiting verification).
 *
 * 3. Order is GAGAL if:
 *    - order.rentalPaymentStatus === FAILED (payment claim rejected).
 *
 * 4. Order is DP_TERBAYAR if:
 *    - order.status !== DRAFT AND depositAmount > 0 (partial down payment received).
 *
 * 5. Otherwise:
 *    - BELUM_BAYAR (unpaid).
 */
export function evaluateRentalPaymentStatus(
  order: RentalPaymentStatusInput | null | undefined
): RentalPaymentStatusInfo {
  if (!order) {
    return {
      status: 'BELUM_BAYAR',
      label: CANONICAL_PAYMENT_LABELS.BELUM_BAYAR,
      badgeVariant: CANONICAL_PAYMENT_BADGE_VARIANTS.BELUM_BAYAR,
      badgeClass: CANONICAL_PAYMENT_BADGE_CLASSES.BELUM_BAYAR,
      isLunas: false,
      hasDownPayment: false,
      depositAmount: 0,
      totalAmount: 0,
      remainingAmount: 0,
    };
  }

  const deposit = Math.max(0, parseNumberLike(order.depositAmount));
  const total = Math.max(0, parseNumberLike(order.totalAmount));
  const status = order.status;
  const rentalPaymentStatus = order.rentalPaymentStatus;

  const isComplete = status === RentalOrderStatus.COMPLETED;
  const isConfirmed = rentalPaymentStatus === RentalPaymentStatus.CONFIRMED;
  const isFullDeposit =
    status !== RentalOrderStatus.DRAFT && deposit >= total && total > 0;

  if (isComplete || isConfirmed || isFullDeposit) {
    return {
      status: 'LUNAS',
      label: CANONICAL_PAYMENT_LABELS.LUNAS,
      badgeVariant: CANONICAL_PAYMENT_BADGE_VARIANTS.LUNAS,
      badgeClass: CANONICAL_PAYMENT_BADGE_CLASSES.LUNAS,
      isLunas: true,
      hasDownPayment: deposit > 0,
      depositAmount: deposit,
      totalAmount: total,
      remainingAmount: 0,
    };
  }

  const remaining = Math.max(0, total - deposit);

  if (rentalPaymentStatus === RentalPaymentStatus.AWAITING_CONFIRM) {
    return {
      status: 'MENUNGGU_VERIFIKASI',
      label: CANONICAL_PAYMENT_LABELS.MENUNGGU_VERIFIKASI,
      badgeVariant: CANONICAL_PAYMENT_BADGE_VARIANTS.MENUNGGU_VERIFIKASI,
      badgeClass: CANONICAL_PAYMENT_BADGE_CLASSES.MENUNGGU_VERIFIKASI,
      isLunas: false,
      hasDownPayment: deposit > 0,
      depositAmount: deposit,
      totalAmount: total,
      remainingAmount: remaining,
    };
  }

  if (rentalPaymentStatus === RentalPaymentStatus.FAILED) {
    return {
      status: 'GAGAL',
      label: CANONICAL_PAYMENT_LABELS.GAGAL,
      badgeVariant: CANONICAL_PAYMENT_BADGE_VARIANTS.GAGAL,
      badgeClass: CANONICAL_PAYMENT_BADGE_CLASSES.GAGAL,
      isLunas: false,
      hasDownPayment: deposit > 0,
      depositAmount: deposit,
      totalAmount: total,
      remainingAmount: remaining,
    };
  }

  if (status !== RentalOrderStatus.DRAFT && deposit > 0) {
    return {
      status: 'DP_TERBAYAR',
      label: CANONICAL_PAYMENT_LABELS.DP_TERBAYAR,
      badgeVariant: CANONICAL_PAYMENT_BADGE_VARIANTS.DP_TERBAYAR,
      badgeClass: CANONICAL_PAYMENT_BADGE_CLASSES.DP_TERBAYAR,
      isLunas: false,
      hasDownPayment: true,
      depositAmount: deposit,
      totalAmount: total,
      remainingAmount: remaining,
    };
  }

  return {
    status: 'BELUM_BAYAR',
    label: CANONICAL_PAYMENT_LABELS.BELUM_BAYAR,
    badgeVariant: CANONICAL_PAYMENT_BADGE_VARIANTS.BELUM_BAYAR,
    badgeClass: CANONICAL_PAYMENT_BADGE_CLASSES.BELUM_BAYAR,
    isLunas: false,
    hasDownPayment: false,
    depositAmount: 0,
    totalAmount: total,
    remainingAmount: total,
  };
}

/**
 * Determines whether a rental order matches a given payment filter.
 * Supports canonical statuses ('LUNAS', 'MENUNGGU_VERIFIKASI', etc.)
 * as well as legacy RentalPaymentStatus enums ('CONFIRMED', 'PENDING', etc.).
 */
export function matchesRentalPaymentFilter(
  order: RentalPaymentStatusInput | null | undefined,
  filter: CanonicalPaymentStatus | RentalPaymentStatus | 'ALL' | string
): boolean {
  if (filter === 'ALL') return true;
  const evaluated = evaluateRentalPaymentStatus(order);

  // Normalize filter aliases
  if (
    filter === 'LUNAS' ||
    filter === RentalPaymentStatus.CONFIRMED
  ) {
    return evaluated.status === 'LUNAS';
  }

  if (
    filter === 'MENUNGGU_VERIFIKASI' ||
    filter === RentalPaymentStatus.AWAITING_CONFIRM
  ) {
    return evaluated.status === 'MENUNGGU_VERIFIKASI';
  }

  if (
    filter === 'GAGAL' ||
    filter === RentalPaymentStatus.FAILED
  ) {
    return evaluated.status === 'GAGAL';
  }

  if (filter === 'DP_TERBAYAR') {
    return evaluated.status === 'DP_TERBAYAR';
  }

  if (
    filter === 'BELUM_BAYAR' ||
    filter === RentalPaymentStatus.PENDING
  ) {
    return evaluated.status === 'BELUM_BAYAR';
  }

  return evaluated.status === filter;
}
