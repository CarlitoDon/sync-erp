import { describe, expect, it } from 'vitest';
import { DomainError, DomainErrorCodes } from '../../src/errors/domain-error';
import {
  requireOrderNumber,
  assertHasOrderNumber,
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
