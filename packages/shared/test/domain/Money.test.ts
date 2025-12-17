import { describe, it, expect } from 'vitest';
import { Money } from '../../src/domain/Money';
import { Decimal } from 'decimal.js';

describe('Money', () => {
  it('should create from number', () => {
    const m = Money.from(100);
    expect(m.amount).toBe(100);
    expect(m.currency).toBe('USD');
  });

  it('should add money', () => {
    const m1 = Money.from(100);
    const m2 = Money.from(50);
    const result = m1.add(m2);
    expect(result.amount).toBe(150);
    expect(result.currency).toBe('USD');
  });

  it('should subtract money', () => {
    const m1 = Money.from(100);
    const m2 = Money.from(30);
    const result = m1.subtract(m2);
    expect(result.amount).toBe(70);
  });

  it('should throw on currency mismatch', () => {
    const m1 = Money.from(100, 'USD');
    const m2 = Money.from(50, 'EUR');
    expect(() => m1.add(m2)).toThrow(/Currency mismatch/);
  });

  it('should multiply', () => {
    const m = Money.from(100);
    const result = m.multiply(0.5);
    expect(result.amount).toBe(50);
  });

  it('should allocate correctly', () => {
    // 100 split 3 ways
    const m = Money.from(100);
    const parts = m.allocate([1, 1, 1]);

    // 33.33, 33.33, 33.33 -> sum 99.99. Remainder 0.01 added to first?
    // Implementation added remainder to first.
    expect(parts.length).toBe(3);

    const sum = parts.reduce((s, p) => s + p.amount, 0);
    expect(sum).toBe(100);

    // Check distribution
    // 33.33 * 3 = 99.99. Diff 0.01.
    // Result[0] should be 33.34?
    expect(parts[0].amount).toBeCloseTo(33.34);
    expect(parts[1].amount).toBe(33.33);
    expect(parts[2].amount).toBe(33.33);
  });
});
