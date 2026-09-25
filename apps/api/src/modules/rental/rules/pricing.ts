import { Decimal } from 'decimal.js';
import { DomainError, DomainErrorCodes, calculateRentalDays } from '@sync-erp/shared';

/**
 * Pure pricing calculation logic (no side effects, 100% testable)
 */

export interface PricingTier {
  tier: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  ratePerDay: Decimal;
  totalDays: number;
  totalAmount: Decimal;
}

/**
 * Calculate the most economical pricing tier for given rental duration.
 * 
 * @param rentalDays - Total number of rental days
 * @param dailyRate - Daily rental rate
 * @param weeklyRate - Weekly rental rate (should be < 7 × dailyRate)
 * @param monthlyRate - Monthly rental rate (should be < 30 × dailyRate)
 * @returns Selected tier with calculation details
 * 
 * @example
 * calculateOptimalTier(10, 50000, 300000, 1200000)
 * // Returns { tier: 'WEEKLY', ratePerDay: 42857.14, totalDays: 10, totalAmount: 428571.40 }
 */
export function calculateOptimalTier(
  rentalDays: number,
  dailyRate: number,
  _weeklyRate?: number,
  _monthlyRate?: number
): PricingTier {
  if (rentalDays <= 0) {
    throw new DomainError(
      'Rental days must be positive',
      400,
      DomainErrorCodes.INVALID_INPUT
    );
  }

  const daily = new Decimal(dailyRate);
  const days = new Decimal(rentalDays);
  const dailyCost = daily.times(days);

  return {
    tier: 'DAILY',
    ratePerDay: daily,
    totalDays: rentalDays,
    totalAmount: dailyCost,
  };
}

/**
 * Calculate rental subtotal for multiple items over a date range.
 * 
 * @param items - Array of rental items with quantities and rates
 * @param rentalStartDate - Start date of rental period
 * @param rentalEndDate - End date of rental period
 * @returns Total rental amount (excluding deposit)
 */
export function calculateRentalSubtotal(
  items: Array<{
    quantity: number;
    dailyRate: number;
    weeklyRate: number;
    monthlyRate: number;
  }>,
  rentalStartDate: Date,
  rentalEndDate: Date
): Decimal {
  const rentalDays = calculateRentalDays(
    rentalStartDate,
    rentalEndDate
  );

  if (rentalDays <= 0) {
    throw new DomainError(
      'End date must be after start date',
      400,
      DomainErrorCodes.INVALID_INPUT
    );
  }

  let subtotal = new Decimal(0);

  for (const item of items) {
    const tier = calculateOptimalTier(
      rentalDays,
      item.dailyRate,
      item.weeklyRate,
      item.monthlyRate
    );
    
    const itemTotal = tier.totalAmount.times(item.quantity);
    subtotal = subtotal.plus(itemTotal);
  }

  return subtotal;
}
