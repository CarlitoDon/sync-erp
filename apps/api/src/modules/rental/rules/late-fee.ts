import { Decimal } from 'decimal.js';

/**
 * Pure late fee calculation logic (no side effects, 100% testable)
 */

export interface LateFeeCalculation {
  isLate: boolean;
  daysLate: number;
  gracePeriodHours: number;
  lateFeeDailyRate: Decimal;
  totalLateFee: Decimal;
  extendedRentalFee: Decimal;
  grandTotal: Decimal;
}

/**
 * Calculate late fees with grace period support.
 * 
 * Grace period logic:
 * - Grace period applies to the DUE DATETIME, not just date
 * - If returned within grace period after due time, no late fee
 * - After grace period, late fee starts accumulating
 * 
 * @param dueDateTime - Expected return date and time
 * @param actualReturnDateTime - Actual return date and time
 * @param gracePeriodHours - Hours of grace period (e.g., 2 hours)
 * @param lateFeeDailyRate - Daily late fee amount
 * @param dailyRentalRate - Daily rental rate (for extended rental charges)
 * @returns Late fee calculation breakdown
 * 
 * @example
 * // Due: 2026-01-10 18:00, Returned: 2026-01-10 19:30, Grace: 2 hours
 * // Result: Not late (within grace period)
 * 
 * @example
 * // Due: 2026-01-10 18:00, Returned: 2026-01-12 10:00, Grace: 2 hours
 * // Result: 1.67 days late, late fee = 1.67 × lateFeeDailyRate
 */
export function calculateLateFee(
  dueDateTime: Date,
  actualReturnDateTime: Date,
  gracePeriodHours: number,
  lateFeeDailyRate: Decimal,
  dailyRentalRate: Decimal
): LateFeeCalculation {
  // Calculate grace period deadline
  const gracePeriodMs = gracePeriodHours * 60 * 60 * 1000;
  const gracePeriodDeadline = new Date(dueDateTime.getTime() + gracePeriodMs);

  // Check if returned within grace period
  if (actualReturnDateTime <= gracePeriodDeadline) {
    return {
      isLate: false,
      daysLate: 0,
      gracePeriodHours,
      lateFeeDailyRate,
      totalLateFee: new Decimal(0),
      extendedRentalFee: new Decimal(0),
      grandTotal: new Decimal(0),
    };
  }

  // Calculate how late (in days, fractional)
  const lateMs = actualReturnDateTime.getTime() - gracePeriodDeadline.getTime();
  const lateDays = lateMs / (1000 * 60 * 60 * 24);

  // Late fee calculation
  const totalLateFee = lateFeeDailyRate.times(lateDays);

  // Extended rental fee (customer still "using" the item)
  const extendedRentalFee = dailyRentalRate.times(lateDays);

  // Total charges = late fee + extended rental
  const grandTotal = totalLateFee.plus(extendedRentalFee);

  return {
    isLate: true,
    daysLate: Number(lateDays.toFixed(2)),
    gracePeriodHours,
    lateFeeDailyRate,
    totalLateFee,
    extendedRentalFee,
    grandTotal,
  };
}

/**
 * Check if order should be auto-cancelled due to no-show (pickup grace period exceeded).
 * 
 * @param rentalStartDate - Scheduled pickup date
 * @param pickupGracePeriodHours - Hours to wait before auto-cancel (e.g., 24 hours)
 * @param currentDateTime - Current date/time (for testing)
 * @returns Whether order should be auto-cancelled
 * 
 * @example
 * // Rental start: 2026-01-10 09:00, Grace: 24 hours, Now: 2026-01-11 10:00
 * // Result: true (25 hours passed, should cancel)
 */
export function shouldAutoCancelOrder(
  rentalStartDate: Date,
  pickupGracePeriodHours: number,
  currentDateTime: Date = new Date()
): boolean {
  const gracePeriodMs = pickupGracePeriodHours * 60 * 60 * 1000;
  const autoCancelDeadline = new Date(rentalStartDate.getTime() + gracePeriodMs);

  return currentDateTime > autoCancelDeadline;
}

/**
 * Calculate additional charges for return settlement.
 * 
 * @param lateFeeCalc - Late fee calculation result
 * @param damageCharges - Sum of damage repair costs
 * @param depositAmount - Original deposit amount
 * @returns Settlement breakdown (deductions, refunds, additional charges)
 */
export function calculateReturnSettlement(
  lateFeeCalc: LateFeeCalculation,
  damageCharges: Decimal,
  depositAmount: Decimal
): {
  totalCharges: Decimal;
  depositDeduction: Decimal;
  depositRefund: Decimal;
  additionalChargesDue: Decimal;
} {
  // Total charges = late fees + damages
  const totalCharges = lateFeeCalc.grandTotal.plus(damageCharges);

  // Deduct from deposit first
  const depositDeduction = Decimal.min(totalCharges, depositAmount);
  const depositRefund = depositAmount.minus(depositDeduction);

  // Additional charges if total exceeds deposit
  const additionalChargesDue = Decimal.max(
    new Decimal(0),
    totalCharges.minus(depositAmount)
  );

  return {
    totalCharges,
    depositDeduction,
    depositRefund,
    additionalChargesDue,
  };
}
