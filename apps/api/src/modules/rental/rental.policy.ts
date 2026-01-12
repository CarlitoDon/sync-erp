import {
  RentalItemUnit,
  UnitStatus,
  RentalOrder,
  RentalOrderStatus,
  RentalReturn,
  ReturnStatus,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

export class RentalPolicy {
  /**
   * Ensure order has items before confirmation.
   */
  static ensureHasItems(items: unknown[]): void {
    if (!items || items.length === 0) {
      throw new DomainError(
        'Rental order must have at least one item',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }

  /**
   * Ensure all requested units are available for assignment.
   */
  static ensureUnitsAvailable(
    units: RentalItemUnit[],
    requestedIds: string[]
  ): void {
    const unavailable = units.filter(
      (u) => u.status !== UnitStatus.AVAILABLE
    );

    if (unavailable.length > 0) {
      const codes = unavailable.map((u) => u.unitCode).join(', ');
      throw new DomainError(
        `The following units are not available: ${codes}`,
        400,
        DomainErrorCodes.INSUFFICIENT_STOCK
      );
    }

    if (units.length !== requestedIds.length) {
      throw new DomainError(
        'Some requested units could not be found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }
  }

  /**
   * Ensure order is in valid status for modification.
   */
  static ensureIsDraft(order: RentalOrder): void {
    if (order.status !== RentalOrderStatus.DRAFT) {
      throw new DomainError(
        `Order cannot be modified in status ${order.status}`,
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Ensure order can be confirmed (must be DRAFT).
   */
  static ensureCanConfirm(order: RentalOrder): void {
    if (order.status !== RentalOrderStatus.DRAFT) {
      throw new DomainError(
        `Only DRAFT orders can be confirmed. Current status: ${order.status}`,
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Ensure deposit amount meets policy requirements.
   */
  static ensureDepositSufficient(
    depositAmount: number,
    requiredAmount: number
  ): void {
    if (depositAmount < requiredAmount) {
      throw new DomainError(
        `Deposit amount ${depositAmount} is less than required ${requiredAmount}`,
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }

  /**
   * Ensure order can be released (must be CONFIRMED).
   */
  static ensureCanRelease(order: RentalOrder): void {
    if (order.status !== RentalOrderStatus.CONFIRMED) {
      throw new DomainError(
        `Only CONFIRMED orders can be released. Current status: ${order.status}`,
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Ensure unit assignments match order items before release.
   */
  static ensureAssignmentsValid(
    orderItems: { rentalItemId: string; quantity: number }[],
    assignments: { rentalItemUnit: { rentalItemId: string } }[]
  ): void {
    // Check if total assigned matches total required
    const requiredTotal = orderItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    if (assignments.length !== requiredTotal) {
      throw new DomainError(
        `Assigned ${assignments.length} units but order requires ${requiredTotal}`,
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    // Check per-item counts (simplified)
    // In strict mode, we would count per rentalItemId.
    // Assuming simplistic check for MVP:
    const assignedByItem = new Map<string, number>();
    for (const a of assignments) {
      const itemId = a.rentalItemUnit.rentalItemId;
      assignedByItem.set(
        itemId,
        (assignedByItem.get(itemId) || 0) + 1
      );
    }

    for (const item of orderItems) {
      const assigned = assignedByItem.get(item.rentalItemId) || 0;
      if (assigned !== item.quantity) {
        throw new DomainError(
          `Item ${item.rentalItemId} requires ${item.quantity} units, assigned ${assigned}`,
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
    }
  }

  /**
   * Ensure order can be returned (must be ACTIVE).
   */
  static ensureCanReturn(order: RentalOrder): void {
    if (order.status !== RentalOrderStatus.ACTIVE) {
      throw new DomainError(
        `Only ACTIVE orders can be returned. Current status: ${order.status}`,
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Ensure order can be cancelled (DRAFT or CONFIRMED).
   */
  static ensureCanCancel(order: RentalOrder): void {
    if (
      order.status !== RentalOrderStatus.DRAFT &&
      order.status !== RentalOrderStatus.CONFIRMED
    ) {
      throw new DomainError(
        `Cannot cancel order in status ${order.status}`,
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Ensure unit is not retired.
   */
  static ensureNotRetired(unit: RentalItemUnit): void {
    if (unit.status === UnitStatus.RETIRED) {
      throw new DomainError(
        `Unit ${unit.unitCode} is RETIRED and cannot be used`,
        400,
        DomainErrorCodes.NOT_FOUND
      );
    }
  }

  /**
   * Validate unit status transition.
   */
  static validateUnitStatusTransition(
    currentStatus: UnitStatus,
    newStatus: UnitStatus
  ): void {
    const validTransitions: Record<UnitStatus, UnitStatus[]> = {
      [UnitStatus.AVAILABLE]: [UnitStatus.RESERVED, UnitStatus.RETIRED],
      [UnitStatus.RESERVED]: [
        UnitStatus.AVAILABLE,
        UnitStatus.RENTED,
        UnitStatus.RETIRED,
      ],
      [UnitStatus.RENTED]: [UnitStatus.RETURNED, UnitStatus.RETIRED],
      [UnitStatus.RETURNED]: [UnitStatus.CLEANING, UnitStatus.RETIRED],
      [UnitStatus.CLEANING]: [
        UnitStatus.AVAILABLE,
        UnitStatus.MAINTENANCE,
        UnitStatus.RETIRED,
      ],
      [UnitStatus.MAINTENANCE]: [UnitStatus.AVAILABLE, UnitStatus.RETIRED],
      [UnitStatus.RETIRED]: [], // Terminal state
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new DomainError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * Validate settlement for finalization.
   */
  static validateSettlement(returnRecord: RentalReturn): void {
    if (returnRecord.settlementStatus !== ReturnStatus.DRAFT) {
      throw new DomainError(
        'Can only finalize DRAFT settlements',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }
}
