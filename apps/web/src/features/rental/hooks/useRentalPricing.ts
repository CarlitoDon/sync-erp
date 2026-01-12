import { useMemo } from 'react';
import { DepositPolicyType } from '@sync-erp/shared';

interface OrderItem {
  rentalItemId: string;
  quantity: number;
}

interface RentalItem {
  id: string;
  dailyRate: unknown;
  weeklyRate: unknown;
  monthlyRate: unknown;
  depositPolicyType: DepositPolicyType;
  depositPercentage?: unknown;
  depositPerUnit?: unknown;
}

interface PricingResult {
  subtotal: number;
  depositRequired: number;
}

/**
 * Calculate rental pricing based on items, rates, and duration.
 * Automatically applies best pricing tier (daily/weekly/monthly).
 */
export function useRentalPricing(
  items: OrderItem[],
  rentalItems: RentalItem[],
  rentalDays: number
): PricingResult {
  return useMemo(() => {
    let subtotal = 0;
    let depositRequired = 0;

    items.forEach((item) => {
      const rentalItem = rentalItems.find(
        (ri) => ri.id === item.rentalItemId
      );
      if (!rentalItem) return;

      // Calculate pricing tier - use the best rate for customer
      let unitPrice = Number(rentalItem.dailyRate) * rentalDays;

      if (rentalDays >= 30) {
        const monthlyPrice = Number(rentalItem.monthlyRate);
        if (monthlyPrice < unitPrice) {
          unitPrice = monthlyPrice;
        }
      } else if (rentalDays >= 7) {
        const weeklyPrice =
          Number(rentalItem.weeklyRate) * Math.ceil(rentalDays / 7);
        if (weeklyPrice < unitPrice) {
          unitPrice = weeklyPrice;
        }
      }

      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      // Calculate deposit based on policy type
      if (
        rentalItem.depositPolicyType === DepositPolicyType.PERCENTAGE
      ) {
        depositRequired +=
          (lineTotal * Number(rentalItem.depositPercentage || 50)) /
          100;
      } else if (
        rentalItem.depositPolicyType === DepositPolicyType.PER_UNIT
      ) {
        depositRequired +=
          Number(rentalItem.depositPerUnit || 0) * item.quantity;
      } else {
        // HYBRID: max of both
        const pctDeposit =
          (lineTotal * Number(rentalItem.depositPercentage || 50)) /
          100;
        const unitDeposit =
          Number(rentalItem.depositPerUnit || 0) * item.quantity;
        depositRequired += Math.max(pctDeposit, unitDeposit);
      }
    });

    return { subtotal, depositRequired };
  }, [items, rentalItems, rentalDays]);
}

/**
 * Calculate rental duration in days between two dates.
 */
export function useRentalDays(
  startDate: string | null,
  endDate: string | null
): number {
  return useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
  }, [startDate, endDate]);
}

/**
 * Get pricing tier label based on rental duration.
 */
export function getPricingTierLabel(rentalDays: number): string {
  if (rentalDays >= 30) return 'tarif bulanan';
  if (rentalDays >= 7) return 'tarif mingguan';
  return 'tarif harian';
}
