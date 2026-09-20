import { describe, expect, it } from 'vitest';
import {
  JOURNAL_REF_PREFIX,
  JournalReferences,
  buildRentalDpRef,
  buildRentalReleaseRef,
  buildRentalExtensionRef,
  buildRentalExtensionLegacyRef,
  buildRentalDamageFeeRef,
  buildRentalLateFeeRef,
  buildRentalRefundDpRef,
  buildRentalDepositRef,
  buildRentalReturnRef,
} from '../../src/constants/journal-references';

describe('Journal References Constants & Builders', () => {
  const orderNumber = 'RO-2026-001';

  describe('JOURNAL_REF_PREFIX', () => {
    it('defines canonical reference prefixes', () => {
      expect(JOURNAL_REF_PREFIX.RENTAL_DP).toBe('Rental DP: ');
      expect(JOURNAL_REF_PREFIX.RENTAL_RELEASE).toBe('Rental Release: ');
      expect(JOURNAL_REF_PREFIX.RENTAL_EXTENSION).toBe('Rental Extension: ');
      expect(JOURNAL_REF_PREFIX.RENTAL_DAMAGE_FEE).toBe('Rental Damage Fee: ');
      expect(JOURNAL_REF_PREFIX.RENTAL_LATE_FEE).toBe('Rental Late Fee: ');
      expect(JOURNAL_REF_PREFIX.RENTAL_REFUND_DP).toBe('Rental Refund DP: ');
      expect(JOURNAL_REF_PREFIX.RENTAL_DEPOSIT).toBe('Rental Deposit: ');
      expect(JOURNAL_REF_PREFIX.RENTAL_RETURN).toBe('Rental Return: ');
    });
  });

  describe('Builder Functions', () => {
    it('builds down payment reference', () => {
      expect(buildRentalDpRef(orderNumber)).toBe('Rental DP: RO-2026-001');
      expect(JournalReferences.rentalDp(orderNumber)).toBe('Rental DP: RO-2026-001');
    });

    it('builds release settlement reference', () => {
      expect(buildRentalReleaseRef(orderNumber)).toBe('Rental Release: RO-2026-001');
      expect(JournalReferences.rentalRelease(orderNumber)).toBe('Rental Release: RO-2026-001');
    });

    it('builds extension reference without extension number or extensionNumber = 1', () => {
      expect(buildRentalExtensionRef(orderNumber)).toBe('Rental Extension: RO-2026-001');
      expect(buildRentalExtensionRef(orderNumber, 1)).toBe('Rental Extension: RO-2026-001');
    });

    it('builds extension reference for extensionNumber > 1', () => {
      expect(buildRentalExtensionRef(orderNumber, 2)).toBe('Rental Extension #2: RO-2026-001');
      expect(buildRentalExtensionRef(orderNumber, 5)).toBe('Rental Extension #5: RO-2026-001');
    });

    it('builds legacy extension reference', () => {
      expect(buildRentalExtensionLegacyRef(orderNumber, 2)).toBe('Rental Extension: RO-2026-001 (Ext #2)');
      expect(JournalReferences.legacyRentalExtension(orderNumber, 2)).toBe('Rental Extension: RO-2026-001 (Ext #2)');
    });

    it('builds damage fee reference', () => {
      expect(buildRentalDamageFeeRef(orderNumber)).toBe('Rental Damage Fee: RO-2026-001');
      expect(JournalReferences.rentalDamageFee(orderNumber)).toBe('Rental Damage Fee: RO-2026-001');
    });

    it('builds late fee reference', () => {
      expect(buildRentalLateFeeRef(orderNumber)).toBe('Rental Late Fee: RO-2026-001');
      expect(JournalReferences.rentalLateFee(orderNumber)).toBe('Rental Late Fee: RO-2026-001');
    });

    it('builds refund down payment reference', () => {
      expect(buildRentalRefundDpRef(orderNumber)).toBe('Rental Refund DP: RO-2026-001');
      expect(JournalReferences.rentalRefundDp(orderNumber)).toBe('Rental Refund DP: RO-2026-001');
    });

    it('builds legacy deposit and return references', () => {
      expect(buildRentalDepositRef(orderNumber)).toBe('Rental Deposit: RO-2026-001');
      expect(JournalReferences.legacyRentalDeposit(orderNumber)).toBe('Rental Deposit: RO-2026-001');
      expect(buildRentalReturnRef(orderNumber)).toBe('Rental Return: RO-2026-001');
      expect(JournalReferences.legacyRentalReturn(orderNumber)).toBe('Rental Return: RO-2026-001');
    });

    it('verifies isRentalRelease helper', () => {
      expect(JournalReferences.isRentalRelease('Rental Release: RO-2026-001')).toBe(true);
      expect(JournalReferences.isRentalRelease('Rental DP: RO-2026-001')).toBe(false);
    });
  });
});
