import { describe, it, expect } from 'vitest';
import { InventoryPolicy } from '@modules/inventory/inventory.policy';
import { BusinessShape } from '@sync-erp/database';
import { DomainErrorCodes } from '@sync-erp/shared';

describe('InventoryPolicy', () => {
  describe('canAdjustStock', () => {
    it('should return true for RETAIL', () => {
      expect(
        InventoryPolicy.canAdjustStock(BusinessShape.RETAIL)
      ).toBe(true);
    });

    it('should return true for MANUFACTURING', () => {
      expect(
        InventoryPolicy.canAdjustStock(BusinessShape.MANUFACTURING)
      ).toBe(true);
    });

    it('should return false for SERVICE', () => {
      expect(
        InventoryPolicy.canAdjustStock(BusinessShape.SERVICE)
      ).toBe(false);
    });

    it('should return false for PENDING', () => {
      expect(
        InventoryPolicy.canAdjustStock(BusinessShape.PENDING)
      ).toBe(false);
    });
  });

  describe('ensureCanAdjustStock', () => {
    it('should not throw for RETAIL', () => {
      expect(() =>
        InventoryPolicy.ensureCanAdjustStock(BusinessShape.RETAIL)
      ).not.toThrow();
    });

    it('should throw SHAPE_PENDING for PENDING', () => {
      try {
        InventoryPolicy.ensureCanAdjustStock(BusinessShape.PENDING);
        expect.fail('Should have thrown');
      } catch (e: unknown) {
        expect((e as { code?: string }).code).toBe(DomainErrorCodes.SHAPE_PENDING);
      }
    });

    it('should throw OPERATION_NOT_ALLOWED for SERVICE', () => {
      try {
        InventoryPolicy.ensureCanAdjustStock(BusinessShape.SERVICE);
        expect.fail('Should have thrown');
      } catch (e: unknown) {
        expect((e as { code?: string }).code).toBe(DomainErrorCodes.OPERATION_NOT_ALLOWED);
      }
    });
  });

  describe('canCreateWIP', () => {
    it('should return true for MANUFACTURING', () => {
      expect(
        InventoryPolicy.canCreateWIP(BusinessShape.MANUFACTURING)
      ).toBe(true);
    });

    it('should return false for RETAIL', () => {
      expect(InventoryPolicy.canCreateWIP(BusinessShape.RETAIL)).toBe(
        false
      );
    });

    it('should return false for SERVICE', () => {
      expect(
        InventoryPolicy.canCreateWIP(BusinessShape.SERVICE)
      ).toBe(false);
    });
  });

  describe('ensureCanCreateWIP', () => {
    it('should not throw for MANUFACTURING', () => {
      expect(() =>
        InventoryPolicy.ensureCanCreateWIP(
          BusinessShape.MANUFACTURING
        )
      ).not.toThrow();
    });

    it('should throw SHAPE_PENDING for PENDING', () => {
      try {
        InventoryPolicy.ensureCanCreateWIP(BusinessShape.PENDING);
        expect.fail('Should have thrown');
      } catch (e: unknown) {
        expect((e as { code?: string }).code).toBe(DomainErrorCodes.SHAPE_PENDING);
      }
    });

    it('should throw OPERATION_NOT_ALLOWED for RETAIL', () => {
      try {
        InventoryPolicy.ensureCanCreateWIP(BusinessShape.RETAIL);
        expect.fail('Should have thrown');
      } catch (e: unknown) {
        expect((e as { code?: string }).code).toBe(DomainErrorCodes.OPERATION_NOT_ALLOWED);
      }
    });
  });

  describe('canUseMultiWarehouse', () => {
    it('should return true for MANUFACTURING', () => {
      expect(
        InventoryPolicy.canUseMultiWarehouse(
          BusinessShape.MANUFACTURING
        )
      ).toBe(true);
    });

    it('should return false for RETAIL', () => {
      expect(
        InventoryPolicy.canUseMultiWarehouse(BusinessShape.RETAIL)
      ).toBe(false);
    });
  });

  describe('canUseReservation', () => {
    it('should return true for MANUFACTURING', () => {
      expect(
        InventoryPolicy.canUseReservation(BusinessShape.MANUFACTURING)
      ).toBe(true);
    });

    it('should return false for RETAIL', () => {
      expect(
        InventoryPolicy.canUseReservation(BusinessShape.RETAIL)
      ).toBe(false);
    });
  });

  describe('getDefaultCostingMethod', () => {
    it('should return AVG for RETAIL', () => {
      expect(
        InventoryPolicy.getDefaultCostingMethod(BusinessShape.RETAIL)
      ).toBe('AVG');
    });

    it('should return FIFO for MANUFACTURING', () => {
      expect(
        InventoryPolicy.getDefaultCostingMethod(
          BusinessShape.MANUFACTURING
        )
      ).toBe('FIFO');
    });

    it('should return null for SERVICE', () => {
      expect(
        InventoryPolicy.getDefaultCostingMethod(BusinessShape.SERVICE)
      ).toBeNull();
    });

    it('should return null for PENDING', () => {
      expect(
        InventoryPolicy.getDefaultCostingMethod(BusinessShape.PENDING)
      ).toBeNull();
    });
  });

  describe('ensureInventoryEnabled', () => {
    it('should not throw when inventory.enabled is not set', () => {
      expect(() =>
        InventoryPolicy.ensureInventoryEnabled([])
      ).not.toThrow();
    });

    it('should not throw when inventory.enabled is true', () => {
      expect(() =>
        InventoryPolicy.ensureInventoryEnabled([
          { key: 'inventory.enabled', value: true },
        ])
      ).not.toThrow();
    });

    it('should throw when inventory.enabled is false', () => {
      try {
        InventoryPolicy.ensureInventoryEnabled([
          { key: 'inventory.enabled', value: false },
        ]);
        expect.fail('Should have thrown');
      } catch (e: unknown) {
        expect((e as { code?: string }).code).toBe(DomainErrorCodes.OPERATION_NOT_ALLOWED);
      }
    });
  });

  describe('ensureSufficientStock', () => {
    it('should not throw when stock is sufficient', () => {
      expect(() =>
        InventoryPolicy.ensureSufficientStock('Product A', 100, 50)
      ).not.toThrow();
    });

    it('should not throw when stock equals required', () => {
      expect(() =>
        InventoryPolicy.ensureSufficientStock('Product A', 50, 50)
      ).not.toThrow();
    });

    it('should throw when stock is insufficient', () => {
      try {
        InventoryPolicy.ensureSufficientStock('Product A', 30, 50);
        expect.fail('Should have thrown');
      } catch (e: unknown) {
        expect((e as { code?: string }).code).toBe(DomainErrorCodes.INSUFFICIENT_STOCK);
        expect((e as { message?: string }).message).toContain('Product A');
      }
    });
  });
});
