import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import {
  evaluateRentalPaymentStatus,
  matchesRentalPaymentFilter,
  parseNumberLike,
  CANONICAL_PAYMENT_LABELS,
  CANONICAL_PAYMENT_BADGE_VARIANTS,
  CANONICAL_PAYMENT_BADGE_CLASSES,
  RentalOrderStatus,
  RentalPaymentStatus,
} from '../src/index';

describe('CHALLENGER 1 STRESS SUITE: evaluateRentalPaymentStatus', () => {
  describe('Boundary & Extreme Numeric Inputs to parseNumberLike', () => {
    it('handles zero values across formats', () => {
      expect(parseNumberLike(0)).toBe(0);
      expect(parseNumberLike('0')).toBe(0);
      expect(parseNumberLike('0.00')).toBe(0);
      expect(parseNumberLike('  0  ')).toBe(0);
      expect(parseNumberLike(new Decimal(0))).toBe(0);
      expect(parseNumberLike({ toNumber: () => 0 })).toBe(0);
      expect(parseNumberLike({ toString: () => '0' })).toBe(0);
    });

    it('handles negative numeric values without throwing', () => {
      expect(parseNumberLike(-100)).toBe(-100);
      expect(parseNumberLike('-50.25')).toBe(-50.25);
      expect(parseNumberLike(new Decimal(-300))).toBe(-300);
      expect(parseNumberLike({ toNumber: () => -42 })).toBe(-42);
      expect(parseNumberLike({ toString: () => '-99.9' })).toBe(-99.9);
    });

    it('handles string decimal variations and edge strings', () => {
      expect(parseNumberLike('100.50')).toBe(100.5);
      expect(parseNumberLike('  250.75  ')).toBe(250.75);
      expect(parseNumberLike('.5')).toBe(0.5);
      expect(parseNumberLike('1e5')).toBe(100000);
      expect(parseNumberLike('0x10')).toBe(16); // Hex string parsing in Number()
      expect(parseNumberLike('')).toBe(0);
      expect(parseNumberLike('   ')).toBe(0);
      expect(parseNumberLike('abc')).toBe(0);
      expect(parseNumberLike('Infinity')).toBe(0);
      expect(parseNumberLike('-Infinity')).toBe(0);
      expect(parseNumberLike('NaN')).toBe(0);
      expect(parseNumberLike('null')).toBe(0);
      expect(parseNumberLike('undefined')).toBe(0);
    });

    it('handles nullish, empty, and invalid types safely', () => {
      expect(parseNumberLike(null)).toBe(0);
      expect(parseNumberLike(undefined)).toBe(0);
      expect(parseNumberLike(true)).toBe(0);
      expect(parseNumberLike(false)).toBe(0);
      expect(parseNumberLike([])).toBe(0);
      expect(parseNumberLike({})).toBe(0);
      expect(parseNumberLike(() => 100)).toBe(0);
    });

    it('handles throwing and malformed Decimal-like objects', () => {
      const explodingToNumber = {
        toNumber: () => {
          throw new Error('Exploding toNumber');
        },
      };
      expect(parseNumberLike(explodingToNumber)).toBe(0);

      const explodingToString = {
        toString: () => {
          throw new Error('Exploding toString');
        },
      };
      expect(parseNumberLike(explodingToString)).toBe(0);

      const nonFiniteToNumber = {
        toNumber: () => NaN,
      };
      expect(parseNumberLike(nonFiniteToNumber)).toBe(0);

      const nonNumberToNumber = {
        toNumber: () => 'not a number' as unknown as number,
      };
      expect(parseNumberLike(nonNumberToNumber)).toBe(0);
    });
  });

  describe('Extreme & Boundary Inputs to evaluateRentalPaymentStatus', () => {
    it('returns BELUM_BAYAR for null, undefined, and empty objects', () => {
      const nullRes = evaluateRentalPaymentStatus(null);
      expect(nullRes.status).toBe('BELUM_BAYAR');
      expect(nullRes.isLunas).toBe(false);
      expect(nullRes.totalAmount).toBe(0);
      expect(nullRes.depositAmount).toBe(0);
      expect(nullRes.remainingAmount).toBe(0);

      const undefRes = evaluateRentalPaymentStatus(undefined);
      expect(undefRes.status).toBe('BELUM_BAYAR');
      expect(undefRes.isLunas).toBe(false);

      const emptyRes = evaluateRentalPaymentStatus({ status: '' });
      expect(emptyRes.status).toBe('BELUM_BAYAR');
      expect(emptyRes.totalAmount).toBe(0);
      expect(emptyRes.depositAmount).toBe(0);
      expect(emptyRes.remainingAmount).toBe(0);
    });

    it('handles zero amounts safely', () => {
      // 0 total, 0 deposit, DRAFT
      const res1 = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.DRAFT,
        totalAmount: 0,
        depositAmount: 0,
      });
      expect(res1.status).toBe('BELUM_BAYAR');
      expect(res1.isLunas).toBe(false);
      expect(res1.remainingAmount).toBe(0);

      // 0 total, 0 deposit, CONFIRMED
      const res2 = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.CONFIRMED,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: 0,
        depositAmount: 0,
      });
      expect(res2.status).toBe('BELUM_BAYAR');
      expect(res2.isLunas).toBe(false);
      expect(res2.remainingAmount).toBe(0);

      // 100 total, 0 deposit, CONFIRMED
      const res3 = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.CONFIRMED,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: 100,
        depositAmount: 0,
      });
      expect(res3.status).toBe('BELUM_BAYAR');
      expect(res3.remainingAmount).toBe(100);

      // 0 total, 100 deposit, CONFIRMED
      // Note: total is 0, so total > 0 is false -> deposit > 0 applies
      const res4 = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.CONFIRMED,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: 0,
        depositAmount: 100,
      });
      expect(res4.status).toBe('DP_TERBAYAR');
      expect(res4.depositAmount).toBe(100);
      expect(res4.remainingAmount).toBe(0);
    });

    it('clamps negative values to 0 without corrupting arithmetic', () => {
      const res = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.CONFIRMED,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: -500,
        depositAmount: -200,
      });
      // Math.max(0, -500) = 0; Math.max(0, -200) = 0
      expect(res.status).toBe('BELUM_BAYAR');
      expect(res.totalAmount).toBe(0);
      expect(res.depositAmount).toBe(0);
      expect(res.remainingAmount).toBe(0);

      const res2 = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.CONFIRMED,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: 1000,
        depositAmount: -300,
      });
      expect(res2.status).toBe('BELUM_BAYAR');
      expect(res2.totalAmount).toBe(1000);
      expect(res2.depositAmount).toBe(0);
      expect(res2.remainingAmount).toBe(1000);
    });

    it('handles Prisma Decimal instances seamlessly', () => {
      const res = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.CONFIRMED,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: new Decimal('1500000.50'),
        depositAmount: new Decimal('500000.25'),
      });
      expect(res.status).toBe('DP_TERBAYAR');
      expect(res.hasDownPayment).toBe(true);
      expect(res.isLunas).toBe(false);
      expect(res.totalAmount).toBe(1500000.5);
      expect(res.depositAmount).toBe(500000.25);
      expect(res.remainingAmount).toBe(1000000.25);
    });

    it('evaluates partial down payments across all order statuses', () => {
      const orderBase = {
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: 1000000,
        depositAmount: 300000,
      };

      // DRAFT: deposit received before confirmation is not yet committed to GL
      const draftRes = evaluateRentalPaymentStatus({
        ...orderBase,
        status: RentalOrderStatus.DRAFT,
      });
      expect(draftRes.status).toBe('BELUM_BAYAR');
      expect(draftRes.hasDownPayment).toBe(false);

      // CONFIRMED
      const confRes = evaluateRentalPaymentStatus({
        ...orderBase,
        status: RentalOrderStatus.CONFIRMED,
      });
      expect(confRes.status).toBe('DP_TERBAYAR');
      expect(confRes.remainingAmount).toBe(700000);

      // ACTIVE
      const actRes = evaluateRentalPaymentStatus({
        ...orderBase,
        status: RentalOrderStatus.ACTIVE,
      });
      expect(actRes.status).toBe('DP_TERBAYAR');
      expect(actRes.remainingAmount).toBe(700000);

      // RETURN_PENDING
      const retRes = evaluateRentalPaymentStatus({
        ...orderBase,
        status: RentalOrderStatus.RETURN_PENDING,
      });
      expect(retRes.status).toBe('DP_TERBAYAR');
      expect(retRes.remainingAmount).toBe(700000);

      // CANCELLED with deposit paid
      const cancelRes = evaluateRentalPaymentStatus({
        ...orderBase,
        status: RentalOrderStatus.CANCELLED,
      });
      expect(cancelRes.status).toBe('DP_TERBAYAR');
      expect(cancelRes.remainingAmount).toBe(700000);

      // COMPLETED: COMPLETED order is always LUNAS regardless of deposit
      const compRes = evaluateRentalPaymentStatus({
        ...orderBase,
        status: RentalOrderStatus.COMPLETED,
      });
      expect(compRes.status).toBe('LUNAS');
      expect(compRes.isLunas).toBe(true);
      expect(compRes.remainingAmount).toBe(0);
    });

    it('evaluates overpayments (deposit > total) accurately', () => {
      const res = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.CONFIRMED,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: 500000,
        depositAmount: 750000,
      });
      expect(res.status).toBe('LUNAS');
      expect(res.isLunas).toBe(true);
      expect(res.hasDownPayment).toBe(true);
      expect(res.totalAmount).toBe(500000);
      expect(res.depositAmount).toBe(750000);
      expect(res.remainingAmount).toBe(0);
    });

    it('handles cancelled orders across various payment states', () => {
      // Cancelled without payment
      const c1 = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.CANCELLED,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: 500000,
        depositAmount: 0,
      });
      expect(c1.status).toBe('BELUM_BAYAR');

      // Cancelled with partial deposit
      const c2 = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.CANCELLED,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: 500000,
        depositAmount: 200000,
      });
      expect(c2.status).toBe('DP_TERBAYAR');

      // Cancelled with full deposit paid
      const c3 = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.CANCELLED,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: 500000,
        depositAmount: 500000,
      });
      expect(c3.status).toBe('LUNAS');

      // Cancelled with payment status confirmed
      const c4 = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.CANCELLED,
        rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
        totalAmount: 500000,
        depositAmount: 0,
      });
      expect(c4.status).toBe('LUNAS');

      // Cancelled with awaiting confirmation
      const c5 = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.CANCELLED,
        rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
        totalAmount: 500000,
        depositAmount: 0,
      });
      expect(c5.status).toBe('MENUNGGU_VERIFIKASI');

      // Cancelled with failed payment
      const c6 = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.CANCELLED,
        rentalPaymentStatus: RentalPaymentStatus.FAILED,
        totalAmount: 500000,
        depositAmount: 0,
      });
      expect(c6.status).toBe('GAGAL');
    });

    it('evaluates completed orders as LUNAS regardless of payment fields', () => {
      const comp1 = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.COMPLETED,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: 1000000,
        depositAmount: 0,
      });
      expect(comp1.status).toBe('LUNAS');
      expect(comp1.isLunas).toBe(true);

      const comp2 = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.COMPLETED,
        rentalPaymentStatus: RentalPaymentStatus.FAILED,
        totalAmount: 1000000,
        depositAmount: 0,
      });
      // Status is COMPLETED -> order is closed & settled in ERP
      expect(comp2.status).toBe('LUNAS');
      expect(comp2.isLunas).toBe(true);
    });

    it('ensures badge variants and classes match canonical design specifications', () => {
      for (const s of [RentalOrderStatus.ACTIVE, RentalOrderStatus.DRAFT]) {
        const res = evaluateRentalPaymentStatus({
          status: s,
          rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
        });
        expect(res.badgeVariant).toBe(CANONICAL_PAYMENT_BADGE_VARIANTS.MENUNGGU_VERIFIKASI);
        expect(res.badgeClass).toBe(CANONICAL_PAYMENT_BADGE_CLASSES.MENUNGGU_VERIFIKASI);
      }

      // COMPLETED orders always resolve to LUNAS (success variant) due to completion precedence
      const completedRes = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.COMPLETED,
        rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
      });
      expect(completedRes.badgeVariant).toBe(CANONICAL_PAYMENT_BADGE_VARIANTS.LUNAS);
      expect(completedRes.badgeClass).toBe(CANONICAL_PAYMENT_BADGE_CLASSES.LUNAS);
    });
  });

  describe('matchesRentalPaymentFilter Comprehensive Filter Permutations', () => {
    const orderLunas = {
      status: RentalOrderStatus.ACTIVE,
      rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
      totalAmount: 1000,
      depositAmount: 1000,
    };
    const orderDp = {
      status: RentalOrderStatus.ACTIVE,
      rentalPaymentStatus: RentalPaymentStatus.PENDING,
      totalAmount: 1000,
      depositAmount: 400,
    };
    const orderAwaiting = {
      status: RentalOrderStatus.DRAFT,
      rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
      totalAmount: 1000,
      depositAmount: 0,
    };
    const orderFailed = {
      status: RentalOrderStatus.DRAFT,
      rentalPaymentStatus: RentalPaymentStatus.FAILED,
      totalAmount: 1000,
      depositAmount: 0,
    };
    const orderUnpaid = {
      status: RentalOrderStatus.DRAFT,
      rentalPaymentStatus: RentalPaymentStatus.PENDING,
      totalAmount: 1000,
      depositAmount: 0,
    };

    it('matches ALL unconditionally on any input including null', () => {
      expect(matchesRentalPaymentFilter(orderLunas, 'ALL')).toBe(true);
      expect(matchesRentalPaymentFilter(orderDp, 'ALL')).toBe(true);
      expect(matchesRentalPaymentFilter(orderAwaiting, 'ALL')).toBe(true);
      expect(matchesRentalPaymentFilter(orderFailed, 'ALL')).toBe(true);
      expect(matchesRentalPaymentFilter(orderUnpaid, 'ALL')).toBe(true);
      expect(matchesRentalPaymentFilter(null, 'ALL')).toBe(true);
      expect(matchesRentalPaymentFilter(undefined, 'ALL')).toBe(true);
    });

    it('correctly isolates each category without cross-matching', () => {
      expect(matchesRentalPaymentFilter(orderLunas, 'LUNAS')).toBe(true);
      expect(matchesRentalPaymentFilter(orderLunas, 'DP_TERBAYAR')).toBe(false);
      expect(matchesRentalPaymentFilter(orderLunas, 'BELUM_BAYAR')).toBe(false);

      expect(matchesRentalPaymentFilter(orderDp, 'DP_TERBAYAR')).toBe(true);
      expect(matchesRentalPaymentFilter(orderDp, 'LUNAS')).toBe(false);
      expect(matchesRentalPaymentFilter(orderDp, 'BELUM_BAYAR')).toBe(false);

      expect(matchesRentalPaymentFilter(orderAwaiting, 'MENUNGGU_VERIFIKASI')).toBe(true);
      expect(matchesRentalPaymentFilter(orderAwaiting, 'LUNAS')).toBe(false);

      expect(matchesRentalPaymentFilter(orderFailed, 'GAGAL')).toBe(true);
      expect(matchesRentalPaymentFilter(orderFailed, 'LUNAS')).toBe(false);

      expect(matchesRentalPaymentFilter(orderUnpaid, 'BELUM_BAYAR')).toBe(true);
      expect(matchesRentalPaymentFilter(orderUnpaid, 'DP_TERBAYAR')).toBe(false);
    });

    it('handles legacy enum alias equivalence', () => {
      expect(matchesRentalPaymentFilter(orderLunas, RentalPaymentStatus.CONFIRMED)).toBe(true);
      expect(matchesRentalPaymentFilter(orderAwaiting, RentalPaymentStatus.AWAITING_CONFIRM)).toBe(true);
      expect(matchesRentalPaymentFilter(orderFailed, RentalPaymentStatus.FAILED)).toBe(true);
      expect(matchesRentalPaymentFilter(orderUnpaid, RentalPaymentStatus.PENDING)).toBe(true);
    });

    it('safely handles non-existent filter string', () => {
      expect(matchesRentalPaymentFilter(orderLunas, 'NON_EXISTENT_FILTER')).toBe(false);
      expect(matchesRentalPaymentFilter(null, 'NON_EXISTENT_FILTER')).toBe(false);
    });
  });
});
