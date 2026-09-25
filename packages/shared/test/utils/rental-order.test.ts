import { describe, expect, it } from 'vitest';
import { DomainError, DomainErrorCodes } from '../../src/errors/domain-error';
import {
  requireOrderNumber,
  assertHasOrderNumber,
  calculateRentalDays,
} from '../../src/utils/rental-order';

describe('requireOrderNumber & assertHasOrderNumber', () => {
  it('returns trimmed orderNumber when valid orderNumber is present', () => {
    const order = { id: 'ord-123', orderNumber: '  RO-2026-001  ' };
    const result = requireOrderNumber(order);
    expect(result).toBe('RO-2026-001');
  });

  it('throws DomainError when order is null or undefined', () => {
    expect(() => requireOrderNumber(null)).toThrow(DomainError);
    expect(() => requireOrderNumber(undefined)).toThrow(DomainError);

    try {
      requireOrderNumber(null, 'release settlement');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.statusCode).toBe(400);
      expect(domainErr.code).toBe(DomainErrorCodes.INVALID_INPUT);
      expect(domainErr.message).toContain('release settlement');
    }
  });

  it('throws DomainError when orderNumber is empty, whitespace, or missing', () => {
    expect(() => requireOrderNumber({})).toThrow(DomainError);
    expect(() => requireOrderNumber({ orderNumber: '' })).toThrow(DomainError);
    expect(() => requireOrderNumber({ orderNumber: '   ' })).toThrow(DomainError);
    expect(() => requireOrderNumber({ id: 'ord-456', orderNumber: null })).toThrow(
      DomainError
    );

    try {
      requireOrderNumber({ id: 'ord-999', orderNumber: '' }, 'DP posting');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.statusCode).toBe(400);
      expect(domainErr.code).toBe(DomainErrorCodes.INVALID_INPUT);
      expect(domainErr.message).toContain('DP posting');
      expect(domainErr.message).toContain('ord-999');
    }
  });

  it('narrows type with assertHasOrderNumber', () => {
    const order: { id: string; orderNumber?: string | null } = {
      id: 'ord-1',
      orderNumber: 'RO-100',
    };
    assertHasOrderNumber(order, 'type check context');
    // TypeScript now knows order.orderNumber is string
    const num: string = order.orderNumber;
    expect(num).toBe('RO-100');
  });

  it('assertHasOrderNumber throws when orderNumber is missing', () => {
    const order: { id: string; orderNumber?: string | null } = {
      id: 'ord-2',
      orderNumber: null,
    };
    expect(() => assertHasOrderNumber(order)).toThrow(DomainError);
  });
});

describe('calculateRentalDays', () => {
  it('calculates duration correctly for calendar date strings', () => {
    // 3 days: 23 to 26
    expect(calculateRentalDays('2026-09-23', '2026-09-26')).toBe(3);
    // 1 day: 23 to 24
    expect(calculateRentalDays('2026-09-23', '2026-09-24')).toBe(1);
    // Same day: 23 to 23 (minimum 1 day)
    expect(calculateRentalDays('2026-09-23', '2026-09-23')).toBe(1);
  });

  it('calculates duration correctly when timestamps have delivery/pickup times', () => {
    // Delivery at 10:00 and pickup at 18:00 (8h gap) should still be 3 days for 23 to 26
    const start = new Date('2026-09-23T10:00:00.000Z');
    const end = new Date('2026-09-26T18:00:00.000Z');
    expect(calculateRentalDays(start, end)).toBe(3);

    // 1-day rental with 10:00 delivery and 18:00 pickup
    const start1 = new Date('2026-09-23T10:00:00.000Z');
    const end1 = new Date('2026-09-24T18:00:00.000Z');
    expect(calculateRentalDays(start1, end1)).toBe(1);
  });

  it('handles null, undefined, and invalid inputs gracefully', () => {
    expect(calculateRentalDays(null, '2026-09-26')).toBe(0);
    expect(calculateRentalDays('2026-09-23', null)).toBe(0);
    expect(calculateRentalDays('invalid', '2026-09-26')).toBe(0);
  });
});

