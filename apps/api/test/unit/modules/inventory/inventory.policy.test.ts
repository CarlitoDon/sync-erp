/**
 * Inventory Policy Tests
 *
 * Tests for InventoryPolicy shape-based constraints.
 */

import { describe, it, expect } from 'vitest';
import { BusinessShape } from '@sync-erp/database';
import { DomainError } from '@sync-erp/shared';
import { InventoryPolicy } from '../../../../src/modules/inventory/inventory.policy';

describe('InventoryPolicy', () => {
  describe('canAdjustStock', () => {
    it('returns false for SERVICE shape', () => {
      expect(
        InventoryPolicy.canAdjustStock(BusinessShape.SERVICE)
      ).toBe(false);
    });

    it('returns false for PENDING shape', () => {
      expect(
        InventoryPolicy.canAdjustStock(BusinessShape.PENDING)
      ).toBe(false);
    });

    it('returns true for RETAIL shape', () => {
      expect(
        InventoryPolicy.canAdjustStock(BusinessShape.RETAIL)
      ).toBe(true);
    });

    it('returns true for MANUFACTURING shape', () => {
      expect(
        InventoryPolicy.canAdjustStock(BusinessShape.MANUFACTURING)
      ).toBe(true);
    });
  });

  describe('ensureCanAdjustStock', () => {
    it('throws DomainError for SERVICE shape', () => {
      expect(() =>
        InventoryPolicy.ensureCanAdjustStock(BusinessShape.SERVICE)
      ).toThrowError(DomainError);
    });

    it('throws DomainError for PENDING shape', () => {
      expect(() =>
        InventoryPolicy.ensureCanAdjustStock(BusinessShape.PENDING)
      ).toThrowError(DomainError);
    });

    it('does not throw for RETAIL shape', () => {
      expect(() =>
        InventoryPolicy.ensureCanAdjustStock(BusinessShape.RETAIL)
      ).not.toThrow();
    });

    it('does not throw for MANUFACTURING shape', () => {
      expect(() =>
        InventoryPolicy.ensureCanAdjustStock(
          BusinessShape.MANUFACTURING
        )
      ).not.toThrow();
    });
  });

  describe('canCreateWIP', () => {
    it('returns true only for MANUFACTURING shape', () => {
      expect(
        InventoryPolicy.canCreateWIP(BusinessShape.MANUFACTURING)
      ).toBe(true);
      expect(InventoryPolicy.canCreateWIP(BusinessShape.RETAIL)).toBe(
        false
      );
      expect(
        InventoryPolicy.canCreateWIP(BusinessShape.SERVICE)
      ).toBe(false);
      expect(
        InventoryPolicy.canCreateWIP(BusinessShape.PENDING)
      ).toBe(false);
    });
  });

  describe('ensureCanCreateWIP', () => {
    it('throws DomainError for RETAIL shape', () => {
      expect(() =>
        InventoryPolicy.ensureCanCreateWIP(BusinessShape.RETAIL)
      ).toThrowError(DomainError);
    });

    it('throws DomainError for SERVICE shape', () => {
      expect(() =>
        InventoryPolicy.ensureCanCreateWIP(BusinessShape.SERVICE)
      ).toThrowError(DomainError);
    });

    it('throws DomainError for PENDING shape', () => {
      expect(() =>
        InventoryPolicy.ensureCanCreateWIP(BusinessShape.PENDING)
      ).toThrowError(DomainError);
    });

    it('does not throw for MANUFACTURING shape', () => {
      expect(() =>
        InventoryPolicy.ensureCanCreateWIP(
          BusinessShape.MANUFACTURING
        )
      ).not.toThrow();
    });
  });

  describe('getDefaultCostingMethod', () => {
    it('returns AVG for RETAIL', () => {
      expect(
        InventoryPolicy.getDefaultCostingMethod(BusinessShape.RETAIL)
      ).toBe('AVG');
    });

    it('returns FIFO for MANUFACTURING', () => {
      expect(
        InventoryPolicy.getDefaultCostingMethod(
          BusinessShape.MANUFACTURING
        )
      ).toBe('FIFO');
    });

    it('returns null for SERVICE', () => {
      expect(
        InventoryPolicy.getDefaultCostingMethod(BusinessShape.SERVICE)
      ).toBeNull();
    });
  });

  describe('ensureInventoryEnabled', () => {
    it('throws DomainError if inventory.enabled is false', () => {
      const configs = [{ key: 'inventory.enabled', value: false }];
      expect(() =>
        InventoryPolicy.ensureInventoryEnabled(configs)
      ).toThrowError(DomainError);
    });

    it('does not throw if inventory.enabled is true', () => {
      const configs = [{ key: 'inventory.enabled', value: true }];
      expect(() =>
        InventoryPolicy.ensureInventoryEnabled(configs)
      ).not.toThrow();
    });

    it('does not throw if inventory.enabled is missing (default behavior assumption, or should it block?)', () => {
      // Per implementation: "if (inventoryEnabled && inventoryEnabled.value === false)"
      // So missing config means allowed (default enabled).
      const configs: { key: string; value: any }[] = [];
      expect(() =>
        InventoryPolicy.ensureInventoryEnabled(configs)
      ).not.toThrow();
    });
  });
});
