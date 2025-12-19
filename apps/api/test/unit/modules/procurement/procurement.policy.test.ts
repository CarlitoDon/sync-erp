/**
 * Procurement Policy Tests
 *
 * Tests for PurchaseOrderPolicy shape-based constraints.
 * Mirror of SalesPolicy tests for Modular Parity.
 */

import { describe, it, expect } from 'vitest';
import { BusinessShape } from '@sync-erp/database';
import { DomainError } from '@sync-erp/shared';
import { PurchaseOrderPolicy } from '@modules/procurement/purchase-order.policy';

describe('PurchaseOrderPolicy', () => {
  describe('canPurchasePhysicalGoods', () => {
    it('returns false for SERVICE shape', () => {
      expect(
        PurchaseOrderPolicy.canPurchasePhysicalGoods(
          BusinessShape.SERVICE
        )
      ).toBe(false);
    });

    it('returns false for PENDING shape', () => {
      expect(
        PurchaseOrderPolicy.canPurchasePhysicalGoods(
          BusinessShape.PENDING
        )
      ).toBe(false);
    });

    it('returns true for RETAIL shape', () => {
      expect(
        PurchaseOrderPolicy.canPurchasePhysicalGoods(
          BusinessShape.RETAIL
        )
      ).toBe(true);
    });

    it('returns true for MANUFACTURING shape', () => {
      expect(
        PurchaseOrderPolicy.canPurchasePhysicalGoods(
          BusinessShape.MANUFACTURING
        )
      ).toBe(true);
    });
  });

  describe('ensureCanPurchasePhysicalGoods', () => {
    it('throws DomainError for SERVICE shape', () => {
      expect(() =>
        PurchaseOrderPolicy.ensureCanPurchasePhysicalGoods(
          BusinessShape.SERVICE
        )
      ).toThrowError(DomainError);
    });

    it('throws DomainError for PENDING shape', () => {
      expect(() =>
        PurchaseOrderPolicy.ensureCanPurchasePhysicalGoods(
          BusinessShape.PENDING
        )
      ).toThrowError(DomainError);
    });

    it('does not throw for RETAIL shape', () => {
      expect(() =>
        PurchaseOrderPolicy.ensureCanPurchasePhysicalGoods(
          BusinessShape.RETAIL
        )
      ).not.toThrow();
    });

    it('does not throw for MANUFACTURING shape', () => {
      expect(() =>
        PurchaseOrderPolicy.ensureCanPurchasePhysicalGoods(
          BusinessShape.MANUFACTURING
        )
      ).not.toThrow();
    });
  });

  describe('canCreatePurchaseOrder', () => {
    it('returns true for all shapes except PENDING', () => {
      expect(
        PurchaseOrderPolicy.canCreatePurchaseOrder(BusinessShape.RETAIL)
      ).toBe(true);
      expect(
        PurchaseOrderPolicy.canCreatePurchaseOrder(
          BusinessShape.MANUFACTURING
        )
      ).toBe(true);
      expect(
        PurchaseOrderPolicy.canCreatePurchaseOrder(
          BusinessShape.SERVICE
        )
      ).toBe(true);
      expect(
        PurchaseOrderPolicy.canCreatePurchaseOrder(
          BusinessShape.PENDING
        )
      ).toBe(false);
    });
  });
});
