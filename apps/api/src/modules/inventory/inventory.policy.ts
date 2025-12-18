/**
 * Inventory Policy
 *
 * Enforces BusinessShape constraints for inventory operations.
 * All methods are stateless and unit-testable.
 *
 * Pattern: Policy.ensure*() throws DomainError if constraint violated.
 */

import { BusinessShape, Prisma } from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

/**
 * InventoryPolicy - Shape-based constraints for inventory operations.
 */
export class InventoryPolicy {
  /**
   * Check if stock adjustment is allowed for this shape.
   * SERVICE companies cannot track physical stock.
   */
  static canAdjustStock(shape: BusinessShape): boolean {
    return (
      shape !== BusinessShape.SERVICE &&
      shape !== BusinessShape.PENDING
    );
  }

  /**
   * Ensure stock adjustment is allowed, throw if not.
   */
  static ensureCanAdjustStock(shape: BusinessShape): void {
    if (shape === BusinessShape.PENDING) {
      throw new DomainError(
        'Operations blocked until business shape is selected',
        400,
        DomainErrorCodes.SHAPE_PENDING
      );
    }

    if (!this.canAdjustStock(shape)) {
      throw new DomainError(
        'Stock tracking is disabled for Service companies',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Check if WIP (Work In Progress) operations are allowed.
   * Only MANUFACTURING companies can use WIP.
   */
  static canCreateWIP(shape: BusinessShape): boolean {
    return shape === BusinessShape.MANUFACTURING;
  }

  /**
   * Ensure WIP creation is allowed, throw if not.
   */
  static ensureCanCreateWIP(shape: BusinessShape): void {
    if (shape === BusinessShape.PENDING) {
      throw new DomainError(
        'Operations blocked until business shape is selected',
        400,
        DomainErrorCodes.SHAPE_PENDING
      );
    }

    if (!this.canCreateWIP(shape)) {
      throw new DomainError(
        'Work In Progress (WIP) is only available for Manufacturing companies',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Check if multi-warehouse is allowed for this shape.
   * MANUFACTURING companies have this enabled by default.
   */
  static canUseMultiWarehouse(shape: BusinessShape): boolean {
    return shape === BusinessShape.MANUFACTURING;
  }

  /**
   * Check if reservation is allowed for this shape.
   * Only MANUFACTURING companies have reservation by default.
   */
  static canUseReservation(shape: BusinessShape): boolean {
    return shape === BusinessShape.MANUFACTURING;
  }

  /**
   * Get the default costing method for a shape.
   */
  static getDefaultCostingMethod(
    shape: BusinessShape
  ): 'AVG' | 'FIFO' | null {
    switch (shape) {
      case BusinessShape.RETAIL:
        return 'AVG';
      case BusinessShape.MANUFACTURING:
        return 'FIFO';
      case BusinessShape.SERVICE:
        return null; // No inventory costing for service
      case BusinessShape.PENDING:
        return null;
      default:
        return 'AVG';
    }
  }

  /**
   * Ensure inventory module is enabled in system config.
   * "Config-driven behavior".
   */
  static ensureInventoryEnabled(
    configs: { key: string; value: Prisma.JsonValue }[]
  ): void {
    const inventoryEnabled = configs.find(
      (c) => c.key === 'inventory.enabled'
    );
    if (inventoryEnabled && inventoryEnabled.value === false) {
      throw new DomainError(
        'Inventory module is disabled by configuration',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Ensure sufficient stock is available for shipment.
   * Throws DomainError if stock is insufficient.
   *
   * @param productName - Product name for error message
   * @param availableStock - Current stock quantity
   * @param requiredQuantity - Quantity needed
   */
  static ensureSufficientStock(
    productName: string,
    availableStock: number,
    requiredQuantity: number
  ): void {
    if (availableStock < requiredQuantity) {
      throw new DomainError(
        `Insufficient stock for "${productName}": ` +
          `required ${requiredQuantity}, available ${availableStock}`,
        400,
        DomainErrorCodes.INSUFFICIENT_STOCK
      );
    }
  }
}
