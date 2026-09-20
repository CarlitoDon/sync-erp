import { describe, it, expect } from 'vitest';
import { RentalOrderStatus, UnitStatus, ReturnStatus } from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { RentalPolicy } from '../../../src/modules/rental/rental.policy';

describe('RentalPolicy Centralized Guards (Empirical Verification)', () => {
  describe('ensureCanConfirm', () => {
    it('should allow confirming DRAFT orders', () => {
      expect(() =>
        RentalPolicy.ensureCanConfirm({ status: RentalOrderStatus.DRAFT })
      ).not.toThrow();
    });

    it.each([
      RentalOrderStatus.CONFIRMED,
      RentalOrderStatus.ACTIVE,
      RentalOrderStatus.COMPLETED,
      RentalOrderStatus.CANCELLED,
    ])('should reject confirming order with status %s with DomainError', (status) => {
      try {
        RentalPolicy.ensureCanConfirm({ status });
        expect.fail(`Should have thrown DomainError for status ${status}`);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(DomainError);
        const domainErr = err as DomainError;
        expect(domainErr.statusCode).toBe(400);
        expect(domainErr.code).toBe(DomainErrorCodes.OPERATION_NOT_ALLOWED);
        expect(domainErr.message).toContain(`Only DRAFT orders can be confirmed. Current status: ${status}`);
      }
    });

    it('should reject confirming order with non-standard status like RETURNED', () => {
      try {
        RentalPolicy.ensureCanConfirm({
          status: 'RETURNED' as unknown as RentalOrderStatus,
        });
        expect.fail('Should have thrown DomainError for RETURNED status');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(DomainError);
        const domainErr = err as DomainError;
        expect(domainErr.statusCode).toBe(400);
        expect(domainErr.code).toBe(DomainErrorCodes.OPERATION_NOT_ALLOWED);
        expect(domainErr.message).toContain('Only DRAFT orders can be confirmed. Current status: RETURNED');
      }
    });
  });

  describe('ensureCanCancel', () => {
    it('should allow cancelling DRAFT orders', () => {
      expect(() =>
        RentalPolicy.ensureCanCancel({ status: RentalOrderStatus.DRAFT })
      ).not.toThrow();
    });

    it('should allow cancelling CONFIRMED orders', () => {
      expect(() =>
        RentalPolicy.ensureCanCancel({ status: RentalOrderStatus.CONFIRMED })
      ).not.toThrow();
    });

    it.each([
      RentalOrderStatus.ACTIVE,
      RentalOrderStatus.COMPLETED,
      RentalOrderStatus.CANCELLED,
    ])('should reject cancelling order with status %s with DomainError', (status) => {
      try {
        RentalPolicy.ensureCanCancel({ status });
        expect.fail(`Should have thrown DomainError for status ${status}`);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(DomainError);
        const domainErr = err as DomainError;
        expect(domainErr.statusCode).toBe(400);
        expect(domainErr.code).toBe(DomainErrorCodes.OPERATION_NOT_ALLOWED);
        expect(domainErr.message).toBe(`Cannot cancel order in status ${status}`);
      }
    });

    it('should reject cancelling order with pseudo-status RETURNED', () => {
      try {
        RentalPolicy.ensureCanCancel({
          status: 'RETURNED' as unknown as RentalOrderStatus,
        });
        expect.fail('Should have thrown DomainError for RETURNED status');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(DomainError);
        const domainErr = err as DomainError;
        expect(domainErr.statusCode).toBe(400);
        expect(domainErr.code).toBe(DomainErrorCodes.OPERATION_NOT_ALLOWED);
        expect(domainErr.message).toBe('Cannot cancel order in status RETURNED');
      }
    });
  });

  describe('ensureCanRelease', () => {
    it('should allow releasing CONFIRMED orders', () => {
      expect(() =>
        RentalPolicy.ensureCanRelease({ status: RentalOrderStatus.CONFIRMED })
      ).not.toThrow();
    });

    it.each([
      RentalOrderStatus.DRAFT,
      RentalOrderStatus.ACTIVE,
      RentalOrderStatus.COMPLETED,
      RentalOrderStatus.CANCELLED,
    ])('should reject releasing order in status %s', (status) => {
      expect(() =>
        RentalPolicy.ensureCanRelease({ status })
      ).toThrow(DomainError);
    });
  });

  describe('ensureCanReturn', () => {
    it('should allow returning ACTIVE orders', () => {
      expect(() =>
        RentalPolicy.ensureCanReturn({ status: RentalOrderStatus.ACTIVE })
      ).not.toThrow();
    });

    it.each([
      RentalOrderStatus.DRAFT,
      RentalOrderStatus.CONFIRMED,
      RentalOrderStatus.COMPLETED,
      RentalOrderStatus.CANCELLED,
    ])('should reject returning order in status %s', (status) => {
      expect(() =>
        RentalPolicy.ensureCanReturn({ status })
      ).toThrow(DomainError);
    });
  });

  describe('ensureIsDraft', () => {
    it('should allow DRAFT order', () => {
      expect(() =>
        RentalPolicy.ensureIsDraft({ status: RentalOrderStatus.DRAFT })
      ).not.toThrow();
    });

    it.each([
      RentalOrderStatus.CONFIRMED,
      RentalOrderStatus.ACTIVE,
      RentalOrderStatus.COMPLETED,
      RentalOrderStatus.CANCELLED,
    ])('should reject non-DRAFT status %s', (status) => {
      expect(() =>
        RentalPolicy.ensureIsDraft({ status })
      ).toThrow(DomainError);
    });
  });

  describe('ensureHasItems', () => {
    it('should pass with non-empty items', () => {
      expect(() => RentalPolicy.ensureHasItems([{ id: '1' }])).not.toThrow();
    });

    it('should throw when items empty or null', () => {
      expect(() => RentalPolicy.ensureHasItems([])).toThrow(DomainError);
      expect(() => RentalPolicy.ensureHasItems(null as unknown as unknown[])).toThrow(DomainError);
    });
  });

  describe('validateUnitStatusTransition', () => {
    it('should validate allowed transitions', () => {
      expect(() =>
        RentalPolicy.validateUnitStatusTransition(UnitStatus.AVAILABLE, UnitStatus.RESERVED)
      ).not.toThrow();
      expect(() =>
        RentalPolicy.validateUnitStatusTransition(UnitStatus.RESERVED, UnitStatus.RENTED)
      ).not.toThrow();
      expect(() =>
        RentalPolicy.validateUnitStatusTransition(UnitStatus.RENTED, UnitStatus.RETURNED)
      ).not.toThrow();
    });

    it('should reject invalid transitions', () => {
      expect(() =>
        RentalPolicy.validateUnitStatusTransition(UnitStatus.RENTED, UnitStatus.RESERVED)
      ).toThrow(DomainError);
      expect(() =>
        RentalPolicy.validateUnitStatusTransition(UnitStatus.RETIRED, UnitStatus.AVAILABLE)
      ).toThrow(DomainError);
    });
  });

  describe('validateSettlement', () => {
    it('should allow DRAFT settlement status', () => {
      expect(() =>
        RentalPolicy.validateSettlement({
          settlementStatus: ReturnStatus.DRAFT,
        } as never)
      ).not.toThrow();
    });

    it('should reject non-DRAFT settlement status', () => {
      expect(() =>
        RentalPolicy.validateSettlement({
          settlementStatus: ReturnStatus.SETTLED,
        } as never)
      ).toThrow(DomainError);
    });
  });
});
