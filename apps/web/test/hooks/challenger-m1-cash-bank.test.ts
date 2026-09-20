import { describe, it, expect } from 'vitest';
import {
  isCashBankAccount,
  formatCashBankAccountOption,
  CASH_BANK_HEADER_CODES,
  CashBankAccount,
} from '@/hooks/useCashBankAccounts';

describe('CHALLENGER 1 STRESS SUITE: useCashBankAccounts & isCashBankAccount', () => {
  describe('Tricky & Boundary Account Codes', () => {
    it('strictly excludes all standard COA header codes', () => {
      expect(CASH_BANK_HEADER_CODES).toContain('1100');
      expect(CASH_BANK_HEADER_CODES).toContain('1200');
      expect(CASH_BANK_HEADER_CODES).toContain('1210');

      expect(isCashBankAccount({ code: '1100', isGroup: false })).toBe(false);
      expect(isCashBankAccount({ code: '1200', isGroup: false })).toBe(false);
      expect(isCashBankAccount({ code: '1210', isGroup: false })).toBe(false);
    });

    it('strictly includes valid boundary cash and bank codes', () => {
      // Cash range boundaries
      expect(isCashBankAccount({ code: '1101', isGroup: false })).toBe(true);
      expect(isCashBankAccount({ code: '1150', isGroup: false })).toBe(true);
      expect(isCashBankAccount({ code: '1199', isGroup: false })).toBe(true);

      // Bank range boundaries
      expect(isCashBankAccount({ code: '1201', isGroup: false })).toBe(true);
      expect(isCashBankAccount({ code: '1209', isGroup: false })).toBe(true);
      expect(isCashBankAccount({ code: '1211', isGroup: false })).toBe(true);
      expect(isCashBankAccount({ code: '1299', isGroup: false })).toBe(true);
    });

    it('strictly excludes out-of-range boundary codes', () => {
      expect(isCashBankAccount({ code: '1099', isGroup: false })).toBe(false);
      expect(isCashBankAccount({ code: '1300', isGroup: false })).toBe(false);
      expect(isCashBankAccount({ code: '1000', isGroup: false })).toBe(false);
      expect(isCashBankAccount({ code: '1400', isGroup: false })).toBe(false);
      expect(isCashBankAccount({ code: '2100', isGroup: false })).toBe(false);
      expect(isCashBankAccount({ code: '9999', isGroup: false })).toBe(false);
    });

    it('excludes group accounts regardless of code range', () => {
      expect(isCashBankAccount({ code: '1101', isGroup: true })).toBe(false);
      expect(isCashBankAccount({ code: '1201', isGroup: true })).toBe(false);
      expect(isCashBankAccount({ code: '1199', isGroup: true })).toBe(false);
      expect(isCashBankAccount({ code: '1299', isGroup: true })).toBe(false);
    });

    it('handles null and undefined isGroup property safely', () => {
      // Non-group accounts where isGroup is undefined or false
      expect(isCashBankAccount({ code: '1101', isGroup: undefined })).toBe(true);
      expect(isCashBankAccount({ code: '1101', isGroup: null })).toBe(true);
      expect(isCashBankAccount({ code: '1101' })).toBe(true);
    });

    it('evaluates string comparison edge cases (sub-accounts, 5-digit codes, whitespace)', () => {
      // Empty string
      expect(isCashBankAccount({ code: '', isGroup: false })).toBe(false);

      // Whitespace padded codes
      // ' 1101 ' < '1100' because space character (ASCII 32) < '1' (ASCII 49)
      expect(isCashBankAccount({ code: ' 1101 ', isGroup: false })).toBe(false);

      // Textual codes
      expect(isCashBankAccount({ code: 'CASH', isGroup: false })).toBe(false);
      expect(isCashBankAccount({ code: 'BANK', isGroup: false })).toBe(false);
      expect(isCashBankAccount({ code: 'KAS', isGroup: false })).toBe(false);

      // Sub-accounts with hyphen or dot
      // '1101-01' > '1100' and '1101-01' < '1199' in lexicographical order
      expect(isCashBankAccount({ code: '1101-01', isGroup: false })).toBe(true);
      expect(isCashBankAccount({ code: '1201.01', isGroup: false })).toBe(true);

      // Note on 5-digit accounts:
      // '11010' falls between '1100' and '1199' lexicographically
      expect(isCashBankAccount({ code: '11010', isGroup: false })).toBe(true);

      // '13000' is > '1299', correctly false
      expect(isCashBankAccount({ code: '13000', isGroup: false })).toBe(false);
    });

    it('handles empty account lists gracefully without error', () => {
      const emptyList: CashBankAccount[] = [];
      const filtered = emptyList.filter(isCashBankAccount);
      expect(filtered).toEqual([]);

      const options = filtered.map(formatCashBankAccountOption);
      expect(options).toEqual([]);
    });

    it('formats options correctly with em-dash and trims correctly', () => {
      const option1 = formatCashBankAccountOption({
        id: 'acc-1',
        code: '1101',
        name: 'Kas Besar',
      });
      expect(option1).toEqual({
        value: 'acc-1',
        label: '1101 — Kas Besar',
      });

      const optionSpecial = formatCashBankAccountOption({
        id: 'acc-2',
        code: '1201',
        name: 'Bank BCA (Operasional & Payroll)',
      });
      expect(optionSpecial).toEqual({
        value: 'acc-2',
        label: '1201 — Bank BCA (Operasional & Payroll)',
      });
    });
  });
});
