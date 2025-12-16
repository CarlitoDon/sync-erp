/**
 * Procurement Policy Tests
 *
 * Tests for ProcurementPolicy shape-based constraints.
 * Mirror of SalesPolicy tests for Modular Parity.
 */

import { describe, it, expect } from 'vitest';
import { BusinessShape } from '@sync-erp/database';
import { DomainError } from '@sync-erp/shared';
import { ProcurementPolicy } from '../../../../src/modules/procurement/procurement.policy';

describe('ProcurementPolicy', () => {
  describe('canPurchasePhysicalGoods', () => {
    it('returns false for SERVICE shape', () => {
      expect(
        ProcurementPolicy.canPurchasePhysicalGoods(
          BusinessShape.SERVICE
        )
      ).toBe(false);
    });

    it('returns false for PENDING shape', () => {
      expect(
        ProcurementPolicy.canPurchasePhysicalGoods(
          BusinessShape.PENDING
        )
      ).toBe(false);
    });

    it('returns true for RETAIL shape', () => {
      expect(
        ProcurementPolicy.canPurchasePhysicalGoods(
          BusinessShape.RETAIL
        )
      ).toBe(true);
    });

    it('returns true for MANUFACTURING shape', () => {
      expect(
        ProcurementPolicy.canPurchasePhysicalGoods(
          BusinessShape.MANUFACTURING
        )
      ).toBe(true);
    });
  });

  describe('ensureCanPurchasePhysicalGoods', () => {
    it('throws DomainError for SERVICE shape', () => {
      expect(() =>
        ProcurementPolicy.ensureCanPurchasePhysicalGoods(
          BusinessShape.SERVICE
        )
      ).toThrowError(DomainError);
    });

    it('throws DomainError for PENDING shape', () => {
      expect(() =>
        ProcurementPolicy.ensureCanPurchasePhysicalGoods(
          BusinessShape.PENDING
        )
      ).toThrowError(DomainError);
    });

    it('does not throw for RETAIL shape', () => {
      expect(() =>
        ProcurementPolicy.ensureCanPurchasePhysicalGoods(
          BusinessShape.RETAIL
        )
      ).not.toThrow();
    });

    it('does not throw for MANUFACTURING shape', () => {
      expect(() =>
        ProcurementPolicy.ensureCanPurchasePhysicalGoods(
          BusinessShape.MANUFACTURING
        )
      ).not.toThrow();
    });
  });

  describe('canCreatePurchaseOrder', () => {
    it('returns true for all shapes except PENDING', () => {
      expect(
        ProcurementPolicy.canCreatePurchaseOrder(BusinessShape.RETAIL)
      ).toBe(true);
      expect(
        ProcurementPolicy.canCreatePurchaseOrder(
          BusinessShape.MANUFACTURING
        )
      ).toBe(true);
      expect(
        ProcurementPolicy.canCreatePurchaseOrder(
          BusinessShape.SERVICE
        )
      ).toBe(true);
      expect(
        ProcurementPolicy.canCreatePurchaseOrder(
          BusinessShape.PENDING
        )
      ).toBe(false);
    });
  });
});
