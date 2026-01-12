import { Decimal } from 'decimal.js';
import { DepositPolicyType } from '@sync-erp/database';

/**
 * Pure deposit calculation logic (no side effects, 100% testable)
 */

export interface DepositCalculation {
  totalDeposit: Decimal;
  policyType: DepositPolicyType;
  allocations: Array<{
    rentalItemId: string;
    unitId?: string;
    coverage: Decimal;
  }>;
}

/**
 * Calculate total deposit amount based on policy type.
 * 
 * @param policyType - PERCENTAGE | PER_UNIT | HYBRID
 * @param orderSubtotal - Total rental charges (before deposit)
 * @param unitCount - Number of units in the order
 * @param depositPercentage - Percentage of subtotal (1-100)
 * @param depositPerUnit - Fixed amount per unit
 * @returns Total deposit amount
 */
export function calculateDepositAmount(
  policyType: DepositPolicyType,
  orderSubtotal: Decimal,
  unitCount: number,
  depositPercentage?: number,
  depositPerUnit?: Decimal
): Decimal {
  switch (policyType) {
    case DepositPolicyType.PERCENTAGE: {
      if (!depositPercentage) {
        throw new Error('depositPercentage required for PERCENTAGE policy');
      }
      return orderSubtotal.times(depositPercentage).dividedBy(100);
    }

    case DepositPolicyType.PER_UNIT: {
      if (!depositPerUnit) {
        throw new Error('depositPerUnit required for PER_UNIT policy');
      }
      return depositPerUnit.times(unitCount);
    }

    case DepositPolicyType.HYBRID: {
      if (!depositPercentage || !depositPerUnit) {
        throw new Error('Both depositPercentage and depositPerUnit required for HYBRID policy');
      }
      const percentageDeposit = orderSubtotal.times(depositPercentage).dividedBy(100);
      const perUnitDeposit = depositPerUnit.times(unitCount);
      return Decimal.max(percentageDeposit, perUnitDeposit);
    }

    default:
      throw new Error(`Unknown deposit policy type: ${policyType}`);
  }
}

/**
 * Allocate deposit across units using pro-rata or per-unit strategy.
 * 
 * Strategy:
 * - PER_UNIT or HYBRID: Each unit gets equal share (deposit / unitCount)
 * - PERCENTAGE: Pro-rata by rental value proportion
 * 
 * @param policyType - Deposit policy type
 * @param totalDeposit - Total deposit amount to allocate
 * @param units - Array of units with their rental values
 * @returns Array of allocations per unit
 */
export function allocateDepositToUnits(
  policyType: DepositPolicyType,
  totalDeposit: Decimal,
  units: Array<{
    unitId: string;
    rentalItemId: string;
    rentalValue: Decimal; // Proportional value for this unit
  }>
): Array<{ rentalItemId: string; unitId: string; coverage: Decimal }> {
  if (units.length === 0) {
    throw new Error('Cannot allocate deposit to zero units');
  }

  // Per-unit and hybrid use equal allocation
  if (policyType === DepositPolicyType.PER_UNIT || policyType === DepositPolicyType.HYBRID) {
    const perUnitCoverage = totalDeposit.dividedBy(units.length);
    return units.map((unit) => ({
      rentalItemId: unit.rentalItemId,
      unitId: unit.unitId,
      coverage: perUnitCoverage,
    }));
  }

  // Percentage uses pro-rata allocation
  const totalRentalValue = units.reduce(
    (sum, unit) => sum.plus(unit.rentalValue),
    new Decimal(0)
  );

  if (totalRentalValue.isZero()) {
    throw new Error('Total rental value cannot be zero for pro-rata allocation');
  }

  return units.map((unit) => ({
    rentalItemId: unit.rentalItemId,
    unitId: unit.unitId,
    coverage: totalDeposit.times(unit.rentalValue).dividedBy(totalRentalValue),
  }));
}

/**
 * Calculate deposit deductions based on damages.
 * 
 * @param allocations - Original deposit allocations per unit
 * @param damages - Damage amounts per unit
 * @returns Remaining deposit and deductions per unit
 */
export function calculateDepositDeductions(
  allocations: Array<{ unitId: string; coverage: Decimal }>,
  damages: Array<{ unitId: string; damageAmount: Decimal }>
): {
  totalDeducted: Decimal;
  remainingDeposit: Decimal;
  deductions: Array<{ unitId: string; deducted: Decimal; remaining: Decimal }>;
} {
  const damageMap = new Map(damages.map((d) => [d.unitId, d.damageAmount]));

  let totalDeducted = new Decimal(0);
  const deductions: Array<{ unitId: string; deducted: Decimal; remaining: Decimal }> = [];

  for (const allocation of allocations) {
    const damage = damageMap.get(allocation.unitId) || new Decimal(0);
    const deducted = Decimal.min(allocation.coverage, damage); // Cannot deduct more than coverage
    const remaining = allocation.coverage.minus(deducted);

    totalDeducted = totalDeducted.plus(deducted);
    deductions.push({
      unitId: allocation.unitId,
      deducted,
      remaining,
    });
  }

  const totalCoverage = allocations.reduce(
    (sum, a) => sum.plus(a.coverage),
    new Decimal(0)
  );
  const remainingDeposit = totalCoverage.minus(totalDeducted);

  return {
    totalDeducted,
    remainingDeposit,
    deductions,
  };
}
