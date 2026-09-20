import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import {
  evaluateRentalPaymentStatus,
  matchesRentalPaymentFilter,
  parseNumberLike,
  CANONICAL_PAYMENT_LABELS,
  RentalOrderStatus,
  RentalPaymentStatus,
} from '../src/index';

describe('rental-payment-status utility', () => {
  describe('parseNumberLike', () => {
    it('handles numeric primitives', () => {
      expect(parseNumberLike(100)).toBe(100);
      expect(parseNumberLike(0)).toBe(0);
      expect(parseNumberLike(-50)).toBe(-50);
      expect(parseNumberLike(NaN)).toBe(0);
      expect(parseNumberLike(Infinity)).toBe(0);
    });

    it('handles strings', () => {
      expect(parseNumberLike('500000')).toBe(500000);
      expect(parseNumberLike('12345.67')).toBe(12345.67);
      expect(parseNumberLike('  999  ')).toBe(999);
      expect(parseNumberLike('')).toBe(0);
      expect(parseNumberLike('not-a-number')).toBe(0);
    });

    it('handles null and undefined', () => {
      expect(parseNumberLike(null)).toBe(0);
      expect(parseNumberLike(undefined)).toBe(0);
    });

    it('handles Decimal.js objects with .toNumber()', () => {
      const d = new Decimal(750000);
      expect(parseNumberLike(d)).toBe(750000);
    });

    it('handles custom objects with .toString()', () => {
      const obj = { toString: () => '250000' };
      expect(parseNumberLike(obj)).toBe(250000);
    });

    it('safely catches throwing objects', () => {
      const badObj = {
        toNumber: () => {
          throw new Error('Boom');
        },
      };
      expect(parseNumberLike(badObj)).toBe(0);
    });
  });

  describe('evaluateRentalPaymentStatus', () => {
    it('returns BELUM_BAYAR for null or undefined order', () => {
      const result = evaluateRentalPaymentStatus(null);
      expect(result.status).toBe('BELUM_BAYAR');
      expect(result.label).toBe(CANONICAL_PAYMENT_LABELS.BELUM_BAYAR);
      expect(result.isLunas).toBe(false);
      expect(result.remainingAmount).toBe(0);
    });

    it('evaluates COMPLETED order as LUNAS regardless of rentalPaymentStatus', () => {
      const result = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.COMPLETED,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: 500000,
        depositAmount: 0,
      });

      expect(result.status).toBe('LUNAS');
      expect(result.isLunas).toBe(true);
      expect(result.badgeVariant).toBe('success');
      expect(result.remainingAmount).toBe(0);
      expect(result.label).toBe('Lunas');
    });

    it('evaluates order with CONFIRMED rentalPaymentStatus as LUNAS', () => {
      const result = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.ACTIVE,
        rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
        totalAmount: 1000000,
        depositAmount: 300000,
      });

      expect(result.status).toBe('LUNAS');
      expect(result.isLunas).toBe(true);
      expect(result.remainingAmount).toBe(0);
    });

    it('evaluates non-DRAFT order with full deposit (deposit >= total) as LUNAS', () => {
      const result = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.CONFIRMED,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: new Decimal(500000),
        depositAmount: '500000',
      });

      expect(result.status).toBe('LUNAS');
      expect(result.isLunas).toBe(true);
      expect(result.hasDownPayment).toBe(true);
      expect(result.remainingAmount).toBe(0);
    });

    it('evaluates DRAFT order with full deposit as BELUM_BAYAR (invariants require confirmation)', () => {
      const result = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.DRAFT,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: 500000,
        depositAmount: 500000,
      });

      // DRAFT order money has not been posted to GL yet
      expect(result.status).toBe('BELUM_BAYAR');
      expect(result.isLunas).toBe(false);
      expect(result.remainingAmount).toBe(500000);
    });

    it('evaluates AWAITING_CONFIRM rentalPaymentStatus as MENUNGGU_VERIFIKASI', () => {
      const result = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.DRAFT,
        rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
        totalAmount: 500000,
        depositAmount: 0,
      });

      expect(result.status).toBe('MENUNGGU_VERIFIKASI');
      expect(result.label).toBe('Menunggu Verifikasi');
      expect(result.badgeVariant).toBe('warning');
      expect(result.isLunas).toBe(false);
      expect(result.remainingAmount).toBe(500000);
    });

    it('evaluates FAILED rentalPaymentStatus as GAGAL', () => {
      const result = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.DRAFT,
        rentalPaymentStatus: RentalPaymentStatus.FAILED,
        totalAmount: 500000,
        depositAmount: 0,
      });

      expect(result.status).toBe('GAGAL');
      expect(result.label).toBe('Gagal');
      expect(result.badgeVariant).toBe('destructive');
      expect(result.isLunas).toBe(false);
    });

    it('evaluates partial down payment on CONFIRMED order as DP_TERBAYAR with remaining balance', () => {
      const result = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.CONFIRMED,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: 600000,
        depositAmount: 200000,
      });

      expect(result.status).toBe('DP_TERBAYAR');
      expect(result.label).toBe('DP Terbayar');
      expect(result.isLunas).toBe(false);
      expect(result.hasDownPayment).toBe(true);
      expect(result.depositAmount).toBe(200000);
      expect(result.totalAmount).toBe(600000);
      expect(result.remainingAmount).toBe(400000);
    });

    it('evaluates active order with 0 deposit as BELUM_BAYAR', () => {
      const result = evaluateRentalPaymentStatus({
        status: RentalOrderStatus.ACTIVE,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        totalAmount: 300000,
        depositAmount: 0,
      });

      expect(result.status).toBe('BELUM_BAYAR');
      expect(result.label).toBe('Belum Bayar');
      expect(result.remainingAmount).toBe(300000);
    });
  });

  describe('matchesRentalPaymentFilter', () => {
    const lunasOrder = {
      status: RentalOrderStatus.COMPLETED,
      rentalPaymentStatus: RentalPaymentStatus.PENDING,
      totalAmount: 500000,
      depositAmount: 0,
    };

    const awaitingOrder = {
      status: RentalOrderStatus.DRAFT,
      rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
      totalAmount: 500000,
    };

    const dpOrder = {
      status: RentalOrderStatus.CONFIRMED,
      rentalPaymentStatus: RentalPaymentStatus.PENDING,
      totalAmount: 500000,
      depositAmount: 150000,
    };

    const unpaidOrder = {
      status: RentalOrderStatus.DRAFT,
      rentalPaymentStatus: RentalPaymentStatus.PENDING,
      totalAmount: 500000,
      depositAmount: 0,
    };

    const failedOrder = {
      status: RentalOrderStatus.DRAFT,
      rentalPaymentStatus: RentalPaymentStatus.FAILED,
      totalAmount: 500000,
    };

    it('matches ALL filter unconditionally', () => {
      expect(matchesRentalPaymentFilter(lunasOrder, 'ALL')).toBe(true);
      expect(matchesRentalPaymentFilter(awaitingOrder, 'ALL')).toBe(true);
      expect(matchesRentalPaymentFilter(dpOrder, 'ALL')).toBe(true);
      expect(matchesRentalPaymentFilter(unpaidOrder, 'ALL')).toBe(true);
    });

    it('matches LUNAS via canonical string and RentalPaymentStatus.CONFIRMED', () => {
      expect(matchesRentalPaymentFilter(lunasOrder, 'LUNAS')).toBe(true);
      expect(
        matchesRentalPaymentFilter(
          lunasOrder,
          RentalPaymentStatus.CONFIRMED
        )
      ).toBe(true);
      expect(matchesRentalPaymentFilter(dpOrder, 'LUNAS')).toBe(false);
      expect(matchesRentalPaymentFilter(unpaidOrder, 'LUNAS')).toBe(false);
    });

    it('matches MENUNGGU_VERIFIKASI via canonical string and AWAITING_CONFIRM', () => {
      expect(
        matchesRentalPaymentFilter(awaitingOrder, 'MENUNGGU_VERIFIKASI')
      ).toBe(true);
      expect(
        matchesRentalPaymentFilter(
          awaitingOrder,
          RentalPaymentStatus.AWAITING_CONFIRM
        )
      ).toBe(true);
      expect(
        matchesRentalPaymentFilter(lunasOrder, 'MENUNGGU_VERIFIKASI')
      ).toBe(false);
    });

    it('matches DP_TERBAYAR filter', () => {
      expect(matchesRentalPaymentFilter(dpOrder, 'DP_TERBAYAR')).toBe(
        true
      );
      expect(matchesRentalPaymentFilter(lunasOrder, 'DP_TERBAYAR')).toBe(
        false
      );
      expect(matchesRentalPaymentFilter(unpaidOrder, 'DP_TERBAYAR')).toBe(
        false
      );
    });

    it('matches BELUM_BAYAR via canonical string and RentalPaymentStatus.PENDING', () => {
      expect(matchesRentalPaymentFilter(unpaidOrder, 'BELUM_BAYAR')).toBe(
        true
      );
      expect(
        matchesRentalPaymentFilter(
          unpaidOrder,
          RentalPaymentStatus.PENDING
        )
      ).toBe(true);
      expect(matchesRentalPaymentFilter(dpOrder, 'BELUM_BAYAR')).toBe(
        false
      );
      expect(matchesRentalPaymentFilter(lunasOrder, 'BELUM_BAYAR')).toBe(
        false
      );
    });

    it('matches GAGAL filter', () => {
      expect(matchesRentalPaymentFilter(failedOrder, 'GAGAL')).toBe(true);
      expect(
        matchesRentalPaymentFilter(
          failedOrder,
          RentalPaymentStatus.FAILED
        )
      ).toBe(true);
      expect(matchesRentalPaymentFilter(unpaidOrder, 'GAGAL')).toBe(false);
    });
  });
});
