import { describe, it, expect } from 'vitest';
import { BusinessDate } from '../../src/domain/BusinessDate';

describe('BusinessDate', () => {
  it('should create from valid date', () => {
    const bd = BusinessDate.from(new Date());
    expect(bd.toISODate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should create from string', () => {
    const bd = BusinessDate.from('2024-01-01');
    expect(bd.toISODate()).toBe('2024-01-01');
  });

  it('should throw on invalid date', () => {
    expect(() => BusinessDate.from('invalid')).toThrow(
      'Invalid date'
    );
  });

  it('should detect future date', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const bd = BusinessDate.from(future);

    expect(bd.isFuture()).toBe(true);
    expect(() => bd.ensureValid()).toThrow(
      'Business date cannot be in the future'
    );
  });

  it('should allow valid past date', () => {
    const past = new Date('2020-01-01');
    const bd = BusinessDate.from(past);

    expect(bd.isFuture()).toBe(false);
    expect(() => bd.ensureValid()).not.toThrow();
  });

  it('should allow current date within tolerance', () => {
    const now = new Date();
    // Add 4 minutes (within 5 min tolerance)
    now.setMinutes(now.getMinutes() + 4);
    const bd = BusinessDate.from(now);
    expect(bd.isFuture()).toBe(false);
  });
});
