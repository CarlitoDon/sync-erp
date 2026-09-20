import { describe, expect, it } from 'vitest';
import { DomainError, DomainErrorCodes } from '../src/errors/domain-error';
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
  buildLegacyRentalDepositRef,
  buildLegacyRentalReturnRef,
} from '../src/constants/journal-references';
import {
  requireOrderNumber,
  assertHasOrderNumber,
} from '../src/utils/rental-order';

describe('EMPIRICAL CHALLENGER: Feature 5 & 6 Stress Tests', () => {
  describe('Feature 5: Journal Reference Strings & Builders Contract Stress', () => {
    const orderNumbers = [
      'RO-2026-001',
      'RO-999',
      'ORDER/2026/09/20-001',
      'uuid-1234-5678-9abc',
    ];

    it('validates canonical prefix constants are immutable and match accounting contracts', () => {
      expect(JOURNAL_REF_PREFIX.RENTAL_DP).toBe('Rental DP: ');
      expect(JOURNAL_REF_PREFIX.RENTAL_RELEASE).toBe('Rental Release: ');
      expect(JOURNAL_REF_PREFIX.RENTAL_EXTENSION).toBe('Rental Extension: ');
      expect(JOURNAL_REF_PREFIX.RENTAL_DAMAGE_FEE).toBe('Rental Damage Fee: ');
      expect(JOURNAL_REF_PREFIX.RENTAL_LATE_FEE).toBe('Rental Late Fee: ');
      expect(JOURNAL_REF_PREFIX.RENTAL_REFUND_DP).toBe('Rental Refund DP: ');
      expect(JOURNAL_REF_PREFIX.RENTAL_DEPOSIT).toBe('Rental Deposit: ');
      expect(JOURNAL_REF_PREFIX.RENTAL_RETURN).toBe('Rental Return: ');
      expect(JOURNAL_REF_PREFIX.RENTAL_LEGACY_DEPOSIT).toBe('Rental Deposit: ');
      expect(JOURNAL_REF_PREFIX.RENTAL_LEGACY_RETURN).toBe('Rental Return: ');
    });

    it('verifies exact builder string outputs across diverse order number formats', () => {
      for (const num of orderNumbers) {
        expect(buildRentalDpRef(num)).toBe(`Rental DP: ${num}`);
        expect(buildRentalReleaseRef(num)).toBe(`Rental Release: ${num}`);
        expect(buildRentalDamageFeeRef(num)).toBe(`Rental Damage Fee: ${num}`);
        expect(buildRentalLateFeeRef(num)).toBe(`Rental Late Fee: ${num}`);
        expect(buildRentalRefundDpRef(num)).toBe(`Rental Refund DP: ${num}`);
        expect(buildRentalDepositRef(num)).toBe(`Rental Deposit: ${num}`);
        expect(buildRentalReturnRef(num)).toBe(`Rental Return: ${num}`);
        expect(buildLegacyRentalDepositRef(num)).toBe(`Rental Deposit: ${num}`);
        expect(buildLegacyRentalReturnRef(num)).toBe(`Rental Return: ${num}`);
      }
    });

    it('stress-tests buildRentalExtensionRef with all numeric edge cases', () => {
      const num = 'RO-100';
      // Default / undefined extensionNumber
      expect(buildRentalExtensionRef(num)).toBe('Rental Extension: RO-100');
      // Extension 1 (first extension) uses standard prefix
      expect(buildRentalExtensionRef(num, 1)).toBe('Rental Extension: RO-100');
      // Extension > 1 uses numbered prefix
      expect(buildRentalExtensionRef(num, 2)).toBe('Rental Extension #2: RO-100');
      expect(buildRentalExtensionRef(num, 3)).toBe('Rental Extension #3: RO-100');
      expect(buildRentalExtensionRef(num, 10)).toBe('Rental Extension #10: RO-100');
      // Boundary conditions: 0, negative, NaN
      expect(buildRentalExtensionRef(num, 0)).toBe('Rental Extension: RO-100');
      expect(buildRentalExtensionRef(num, -1)).toBe('Rental Extension: RO-100');
      expect(buildRentalExtensionRef(num, NaN)).toBe('Rental Extension: RO-100');
    });

    it('verifies legacy extension builder format matches historical records', () => {
      expect(buildRentalExtensionLegacyRef('RO-100', 1)).toBe('Rental Extension: RO-100 (Ext #1)');
      expect(buildRentalExtensionLegacyRef('RO-100', 2)).toBe('Rental Extension: RO-100 (Ext #2)');
    });

    it('verifies query compatibility: startsWith and isRentalRelease', () => {
      for (const num of orderNumbers) {
        const releaseRef = buildRentalReleaseRef(num);
        expect(releaseRef.startsWith(JOURNAL_REF_PREFIX.RENTAL_RELEASE)).toBe(true);
        expect(JournalReferences.isRentalRelease(releaseRef)).toBe(true);

        const dpRef = buildRentalDpRef(num);
        expect(dpRef.startsWith(JOURNAL_REF_PREFIX.RENTAL_DP)).toBe(true);
        expect(dpRef.startsWith(JOURNAL_REF_PREFIX.RENTAL_RELEASE)).toBe(false);
        expect(JournalReferences.isRentalRelease(dpRef)).toBe(false);
      }

      // Edge cases for isRentalRelease
      expect(JournalReferences.isRentalRelease('')).toBe(false);
      expect(JournalReferences.isRentalRelease('Rental Release:')).toBe(true);
      expect(JournalReferences.isRentalRelease('Rental Release: ')).toBe(true);
      expect(JournalReferences.isRentalRelease('Something else')).toBe(false);
    });

    it('verifies JournalReferences facade completeness and method bindings', () => {
      expect(JournalReferences.prefixes).toBe(JOURNAL_REF_PREFIX);
      expect(JournalReferences.rentalDp('X')).toBe(buildRentalDpRef('X'));
      expect(JournalReferences.rentalRelease('X')).toBe(buildRentalReleaseRef('X'));
      expect(JournalReferences.rentalExtension('X', 2)).toBe(buildRentalExtensionRef('X', 2));
      expect(JournalReferences.rentalDamageFee('X')).toBe(buildRentalDamageFeeRef('X'));
      expect(JournalReferences.rentalLateFee('X')).toBe(buildRentalLateFeeRef('X'));
      expect(JournalReferences.rentalRefundDp('X')).toBe(buildRentalRefundDpRef('X'));
      expect(JournalReferences.rentalDeposit('X')).toBe(buildRentalDepositRef('X'));
      expect(JournalReferences.rentalReturn('X')).toBe(buildRentalReturnRef('X'));
      expect(JournalReferences.legacyRentalDeposit('X')).toBe(buildLegacyRentalDepositRef('X'));
      expect(JournalReferences.legacyRentalReturn('X')).toBe(buildLegacyRentalReturnRef('X'));
      expect(JournalReferences.legacyRentalExtension('X', 2)).toBe(buildRentalExtensionLegacyRef('X', 2));
      expect(JournalReferences.rentalExtensionLegacy('X', 2)).toBe(buildRentalExtensionLegacyRef('X', 2));
    });
  });

  describe('Feature 6: requireOrderNumber Domain Assertion Stress', () => {
    it('returns trimmed orderNumber for all valid formats', () => {
      expect(requireOrderNumber({ orderNumber: 'RO-1' })).toBe('RO-1');
      expect(requireOrderNumber({ orderNumber: '  RO-1  ' })).toBe('RO-1');
      expect(requireOrderNumber({ orderNumber: '\t\n RO-1 \r\n ' })).toBe('RO-1');
      expect(requireOrderNumber({ id: 'ord-123', orderNumber: 'RO-1' })).toBe('RO-1');
    });

    it('adversarially throws DomainError(400, INVALID_INPUT) on null, undefined, empty, and whitespace', () => {
      const invalidInputs: Array<{
        name: string;
        input: { orderNumber?: string | null; id?: string } | null | undefined;
        context?: string;
        expectedId?: string;
      }> = [
        { name: 'null input without context', input: null },
        { name: 'null input with context', input: null, context: 'DP Posting' },
        { name: 'undefined input without context', input: undefined },
        { name: 'undefined input with context', input: undefined, context: 'Release Settlement' },
        { name: 'empty object {}', input: {} },
        { name: 'empty object with context', input: {}, context: 'Fulfillment' },
        { name: 'missing orderNumber with id', input: { id: 'ord-100' }, expectedId: 'ord-100' },
        { name: 'orderNumber: null without id', input: { orderNumber: null } },
        { name: 'orderNumber: null with id', input: { id: 'ord-101', orderNumber: null }, expectedId: 'ord-101' },
        { name: 'orderNumber: undefined without id', input: { orderNumber: undefined } },
        { name: 'orderNumber: undefined with id', input: { id: 'ord-102', orderNumber: undefined }, expectedId: 'ord-102' },
        { name: 'empty string without id', input: { orderNumber: '' } },
        { name: 'empty string with id', input: { id: 'ord-103', orderNumber: '' }, expectedId: 'ord-103' },
        { name: 'spaces only', input: { id: 'ord-104', orderNumber: '     ' }, expectedId: 'ord-104' },
        { name: 'tabs and newlines only', input: { id: 'ord-105', orderNumber: '\t\r\n  \t' }, expectedId: 'ord-105' },
      ];

      for (const { name, input, context, expectedId } of invalidInputs) {
        let caughtError: unknown = null;
        try {
          requireOrderNumber(input, context);
        } catch (err) {
          caughtError = err;
        }

        expect(caughtError, `Failed on scenario: ${name}`).toBeInstanceOf(DomainError);
        const domainErr = caughtError as DomainError;
        expect(domainErr.statusCode, `Status code mismatch on: ${name}`).toBe(400);
        expect(domainErr.code, `Code mismatch on: ${name}`).toBe(DomainErrorCodes.INVALID_INPUT);
        expect(domainErr.code).toBe('INVALID_INPUT');

        if (context) {
          expect(domainErr.message).toContain(context);
        }
        if (expectedId) {
          expect(domainErr.message).toContain(`(orderId: ${expectedId})`);
        } else {
          expect(domainErr.message).not.toContain('(orderId:');
        }

        // Verify toJSON structure
        const json = domainErr.toJSON();
        expect(json.success).toBe(false);
        expect(json.code).toBe('INVALID_INPUT');
        expect(json.error).toBe(domainErr.message);
      }
    });

    it('stress-tests assertHasOrderNumber with type narrowing and failure modes', () => {
      const validOrder: { id: string; orderNumber?: string | null; other: number } = {
        id: 'ord-1',
        orderNumber: 'RO-VALID',
        other: 42,
      };

      // Valid: does not throw, narrows type
      assertHasOrderNumber(validOrder, 'valid test');
      const narrowedNum: string = validOrder.orderNumber;
      expect(narrowedNum).toBe('RO-VALID');

      // Invalid: throws DomainError
      const invalidOrder: { id: string; orderNumber?: string | null } = {
        id: 'ord-2',
        orderNumber: '   ',
      };
      expect(() => assertHasOrderNumber(invalidOrder, 'invalid test')).toThrow(DomainError);
      expect(() => assertHasOrderNumber(null)).toThrow(DomainError);
      expect(() => assertHasOrderNumber(undefined)).toThrow(DomainError);
    });
  });
});
