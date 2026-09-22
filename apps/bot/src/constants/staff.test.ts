import { describe, it, expect } from 'vitest';
import {
  INTERNAL_STAFF_PHONES,
  INTERNAL_STAFF_LIDS,
  isInternalStaff,
} from './staff';

describe('Internal Staff Registry & Validator', () => {
  describe('isInternalStaff - Admin 1 Sales Santi Mebel (+6281249182155)', () => {
    it('detects Admin 1 by clean international format', () => {
      expect(isInternalStaff('6281249182155')).toBe(true);
    });

    it('detects Admin 1 by local 08 prefix', () => {
      expect(isInternalStaff('081249182155')).toBe(true);
    });

    it('detects Admin 1 by formatted international string', () => {
      expect(isInternalStaff('+62 812-4918-2155')).toBe(true);
    });

    it('detects Admin 1 by WhatsApp JID', () => {
      expect(isInternalStaff('6281249182155@s.whatsapp.net')).toBe(true);
    });

    it('detects Admin 1 by WhatsApp LID with @lid suffix', () => {
      expect(isInternalStaff('75432611295262@lid')).toBe(true);
    });

    it('detects Admin 1 by raw LID digits', () => {
      expect(isInternalStaff('75432611295262')).toBe(true);
    });
  });

  describe('isInternalStaff - Other Internal Staff & Stores', () => {
    it('detects Mas Don (Owner)', () => {
      expect(isInternalStaff('6285158858310')).toBe(true);
      expect(isInternalStaff('085158858310')).toBe(true);
    });

    it('does not classify driver admin test phone (0822-4185-1577) as internal staff', () => {
      expect(isInternalStaff('6282241851577')).toBe(false);
      expect(isInternalStaff('082241851577')).toBe(false);
    });

    it('detects Santi Living Team (Hesy, Andre, Zay)', () => {
      expect(isInternalStaff('628987257284')).toBe(true);
      expect(isInternalStaff('628562747614')).toBe(true);
      expect(isInternalStaff('6283176406083')).toBe(true);
    });

    it('detects Santi Mebel Admins (Admin 2, Admin 3 Godean, Olshop, Adel)', () => {
      expect(isInternalStaff('6285229092368')).toBe(true); // Admin 2
      expect(isInternalStaff('6281326175144')).toBe(true); // Admin 3 Godean
      expect(isInternalStaff('6281393267325')).toBe(true); // Olshop
      expect(isInternalStaff('6283854465788')).toBe(true); // Adel 2
    });

    it('detects Santi Mebel Stores (Berjo, Gamping)', () => {
      expect(isInternalStaff('6282221363560')).toBe(true); // Berjo
      expect(isInternalStaff('39445415862482@lid')).toBe(true); // Berjo LID
      expect(isInternalStaff('6285293361879')).toBe(true); // Gamping
      expect(isInternalStaff('80505320009913@lid')).toBe(true); // Gamping LID
    });

    it('detects Santi Mebel Leadership & Family (Mas Ghana, Ibuk)', () => {
      expect(isInternalStaff('6282138001051')).toBe(true); // Mas Ghana
      expect(isInternalStaff('6289652477983')).toBe(true); // Ghana Privat
      expect(isInternalStaff('6282133903886')).toBe(true); // Ibuk
    });
  });

  describe('isInternalStaff - External Customers & Edge Cases', () => {
    it('returns false for normal customer numbers', () => {
      expect(isInternalStaff('6281234567890')).toBe(false);
      expect(isInternalStaff('081987654321')).toBe(false);
      expect(isInternalStaff('+62 877-1234-5678')).toBe(false);
    });

    it('returns false for empty or invalid input', () => {
      expect(isInternalStaff('')).toBe(false);
      expect(isInternalStaff('   ')).toBe(false);
      expect(isInternalStaff(null)).toBe(false);
      expect(isInternalStaff(undefined)).toBe(false);
      expect(isInternalStaff('abc')).toBe(false);
    });
  });

  describe('Set Completeness', () => {
    it('contains all critical staff numbers in INTERNAL_STAFF_PHONES', () => {
      expect(INTERNAL_STAFF_PHONES.has('6281249182155')).toBe(true); // Admin 1
      expect(INTERNAL_STAFF_PHONES.has('6285229092368')).toBe(true); // Admin 2
      expect(INTERNAL_STAFF_PHONES.has('6281326175144')).toBe(true); // Admin 3
      expect(INTERNAL_STAFF_PHONES.has('6285158858310')).toBe(true); // Don
      expect(INTERNAL_STAFF_PHONES.has('6282241851577')).toBe(false); // Office / Sopir Test Phone is excluded from internal staff
    });

    it('contains all critical staff LIDs in INTERNAL_STAFF_LIDS', () => {
      expect(INTERNAL_STAFF_LIDS.has('75432611295262')).toBe(true); // Admin 1 LID
      expect(INTERNAL_STAFF_LIDS.has('39445415862482')).toBe(true); // Berjo LID
      expect(INTERNAL_STAFF_LIDS.has('80505320009913')).toBe(true); // Gamping LID
    });
  });
});
