import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate } from '../../src/utils/format';

describe('formatCurrency', () => {
  it('should format number to IDR currency', () => {
    expect(formatCurrency(10000)).toMatch(/Rp\s?10\.000/);
    expect(formatCurrency(500)).toMatch(/Rp\s?500/);
    expect(formatCurrency(0)).toMatch(/Rp\s?0/);
  });
});

describe('formatDate', () => {
  it('should format date to ID locale', () => {
    const date = new Date('2023-01-01T12:00:00.000Z');
    // Depending on timezone, might vary, but usually involves "Januari"
    const formatted = formatDate(date);
    expect(formatted).toContain('Januari');
    expect(formatted).toContain('2023');
  });

  it('should handle string input', () => {
    expect(formatDate('2023-12-25')).toContain('Desember');
  });
});
