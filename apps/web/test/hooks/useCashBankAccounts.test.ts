import { describe, it, expect } from 'vitest';
import {
  isCashBankAccount,
  formatCashBankAccountOption,
  CASH_BANK_HEADER_CODES,
} from '@/hooks/useCashBankAccounts';

describe('useCashBankAccounts helper logic', () => {
  describe('isCashBankAccount', () => {
    it('excludes group accounts', () => {
      expect(isCashBankAccount({ code: '1101', isGroup: true })).toBe(false);
      expect(isCashBankAccount({ code: '1201', isGroup: true })).toBe(false);
    });

    it('excludes explicit header and clearing accounts (1100, 1200, 1210)', () => {
      for (const headerCode of CASH_BANK_HEADER_CODES) {
        expect(isCashBankAccount({ code: headerCode, isGroup: false })).toBe(false);
      }
    });

    it('includes valid cash accounts in range 1100..1199', () => {
      expect(isCashBankAccount({ code: '1101', isGroup: false })).toBe(true);
      expect(isCashBankAccount({ code: '1102', isGroup: false })).toBe(true);
      expect(isCashBankAccount({ code: '1199', isGroup: false })).toBe(true);
    });

    it('includes valid bank accounts in range 1200..1299 (excluding 1210)', () => {
      expect(isCashBankAccount({ code: '1201', isGroup: false })).toBe(true);
      expect(isCashBankAccount({ code: '1202', isGroup: false })).toBe(true);
      expect(isCashBankAccount({ code: '1210', isGroup: false })).toBe(false); // Goods in transit
      expect(isCashBankAccount({ code: '1299', isGroup: false })).toBe(true);
    });

    it('excludes accounts outside cash/bank ranges', () => {
      expect(isCashBankAccount({ code: '1300', isGroup: false })).toBe(false); // Accounts Receivable
      expect(isCashBankAccount({ code: '1400', isGroup: false })).toBe(false); // Inventory
      expect(isCashBankAccount({ code: '2100', isGroup: false })).toBe(false); // Accounts Payable
      expect(isCashBankAccount({ code: '2200', isGroup: false })).toBe(false); // Customer Deposits
      expect(isCashBankAccount({ code: '4100', isGroup: false })).toBe(false); // Revenue
    });
  });

  describe('formatCashBankAccountOption', () => {
    it('formats account into option with em-dash format', () => {
      const option = formatCashBankAccountOption({
        id: 'acc-1',
        code: '1101',
        name: 'Kas Operasional',
      });
      expect(option).toEqual({
        value: 'acc-1',
        label: '1101 — Kas Operasional',
      });
    });
  });
});
