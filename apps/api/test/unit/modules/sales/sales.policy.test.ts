/**
 * Sales Policy Tests
 *
 * Tests for SalesPolicy shape-based constraints.
 */

import { describe, it, expect } from 'vitest';
import { BusinessShape } from '@sync-erp/database';
import { DomainError } from '@sync-erp/shared';
import { SalesPolicy } from '../../../../src/modules/sales/sales.policy';

describe('SalesPolicy', () => {
  describe('canSellPhysicalGoods', () => {
    it('returns false for SERVICE shape', () => {
      expect(SalesPolicy.canSellPhysicalGoods(BusinessShape.SERVICE)).toBe(false);
    });

    it('returns false for PENDING shape', () => {
      expect(SalesPolicy.canSellPhysicalGoods(BusinessShape.PENDING)).toBe(false);
    });

    it('returns true for RETAIL shape', () => {
      expect(SalesPolicy.canSellPhysicalGoods(BusinessShape.RETAIL)).toBe(true);
    });

    it('returns true for MANUFACTURING shape', () => {
      expect(SalesPolicy.canSellPhysicalGoods(BusinessShape.MANUFACTURING)).toBe(true);
    });
  });

  describe('ensureCanSellPhysicalGoods', () => {
    it('throws DomainError for SERVICE shape', () => {
      expect(() => SalesPolicy.ensureCanSellPhysicalGoods(BusinessShape.SERVICE))
        .toThrowError(DomainError);
    });

    it('throws DomainError for PENDING shape', () => {
      expect(() => SalesPolicy.ensureCanSellPhysicalGoods(BusinessShape.PENDING))
        .toThrowError(DomainError);
    });

    it('does not throw for RETAIL shape', () => {
      expect(() => SalesPolicy.ensureCanSellPhysicalGoods(BusinessShape.RETAIL))
        .not.toThrow();
    });

    it('does not throw for MANUFACTURING shape', () => {
      expect(() => SalesPolicy.ensureCanSellPhysicalGoods(BusinessShape.MANUFACTURING))
        .not.toThrow();
    });
  });

  describe('canCreateSalesOrder', () => {
    it('returns true for all shapes except PENDING', () => {
      expect(SalesPolicy.canCreateSalesOrder(BusinessShape.RETAIL)).toBe(true);
      expect(SalesPolicy.canCreateSalesOrder(BusinessShape.MANUFACTURING)).toBe(true);
      expect(SalesPolicy.canCreateSalesOrder(BusinessShape.SERVICE)).toBe(true);
      expect(SalesPolicy.canCreateSalesOrder(BusinessShape.PENDING)).toBe(false);
    });
  });

  describe('ensureCanCreateSalesOrder', () => {
    it('throws DomainError for PENDING shape', () => {
      expect(() => SalesPolicy.ensureCanCreateSalesOrder(BusinessShape.PENDING))
        .toThrowError(DomainError);
    });

    it('does not throw for non-PENDING shapes', () => {
      expect(() => SalesPolicy.ensureCanCreateSalesOrder(BusinessShape.RETAIL))
        .not.toThrow();
      expect(() => SalesPolicy.ensureCanCreateSalesOrder(BusinessShape.SERVICE))
        .not.toThrow();
    });
  });
});
