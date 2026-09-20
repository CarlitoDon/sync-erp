import { describe, it, expect } from 'vitest';
import { getDb } from '@sync-erp/database';
import { RentalPolicy } from '../../../src/modules/rental/rental.policy';
import { RentalOrderStatus, DomainError } from '@sync-erp/shared';

describe('CHALLENGER 1 STRESS SUITE: getDb & Rental Policy Guards', () => {
  describe('getDb(tx) helper resolution', () => {
    it('returns default database client when tx is undefined', () => {
      const db = getDb(undefined);
      expect(db).toBeDefined();
      expect(db).not.toBeNull();
    });

    it('returns default database client when tx is null', () => {
      const db = getDb(null);
      expect(db).toBeDefined();
      expect(db).not.toBeNull();
    });

    it('returns default database client when called with no arguments', () => {
      const db = getDb();
      expect(db).toBeDefined();
      expect(db).not.toBeNull();
    });

    it('strictly preserves and returns the active transaction client instance when tx is provided', () => {
      const mockTx = {
        rentalOrder: { findUnique: () => 'mock-rental-order' },
        account: { findFirst: () => 'mock-account' },
        $executeRaw: () => Promise.resolve(1),
      };

      const db = getDb(mockTx as never);
      expect(db).toBe(mockTx);
    });

    it('handles falsy non-nullish objects properly without crashing', () => {
      // Empty object mock transaction
      const emptyTx = {};
      const db = getDb(emptyTx as never);
      expect(db).toBe(emptyTx);
    });
  });

  describe('RentalPolicy.ensureCanConfirm invariant guard', () => {
    it('allows confirmation for DRAFT status', () => {
      expect(() => {
        RentalPolicy.ensureCanConfirm({ status: RentalOrderStatus.DRAFT });
      }).not.toThrow();
    });

    it('strictly rejects confirmation for all other statuses with DomainError', () => {
      const invalidStatuses = [
        RentalOrderStatus.CONFIRMED,
        RentalOrderStatus.ACTIVE,
        RentalOrderStatus.COMPLETED,
        RentalOrderStatus.CANCELLED,
      ];

      for (const status of invalidStatuses) {
        expect(() => {
          RentalPolicy.ensureCanConfirm({ status });
        }).toThrowError(DomainError);

        expect(() => {
          RentalPolicy.ensureCanConfirm({ status });
        }).toThrowError('Only DRAFT orders can be confirmed');
      }
    });
  });

  describe('RentalPolicy.ensureCanCancel invariant guard', () => {
    it('allows cancellation for DRAFT and CONFIRMED statuses', () => {
      expect(() => {
        RentalPolicy.ensureCanCancel({ status: RentalOrderStatus.DRAFT });
      }).not.toThrow();

      expect(() => {
        RentalPolicy.ensureCanCancel({ status: RentalOrderStatus.CONFIRMED });
      }).not.toThrow();
    });

    it('strictly rejects cancellation for in-progress or closed statuses with DomainError', () => {
      const nonCancellableStatuses = [
        RentalOrderStatus.ACTIVE,
        RentalOrderStatus.COMPLETED,
        RentalOrderStatus.CANCELLED,
      ];

      for (const status of nonCancellableStatuses) {
        expect(() => {
          RentalPolicy.ensureCanCancel({ status });
        }).toThrowError(DomainError);

        expect(() => {
          RentalPolicy.ensureCanCancel({ status });
        }).toThrowError(/Cannot cancel order in status/);
      }
    });
  });
});
