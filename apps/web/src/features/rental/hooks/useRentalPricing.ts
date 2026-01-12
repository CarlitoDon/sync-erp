import { useMemo } from 'react';
import { DepositPolicyType } from '@sync-erp/shared';

interface OrderItem {
  rentalItemId?: string;
  rentalBundleId?: string;
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

interface RentalBundle {
  id: string;
  dailyRate: unknown;
  weeklyRate: unknown;
  monthlyRate: unknown;
  // Bundles assume default deposit policy for now (50%)
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
  rentalDays: number,
  rentalBundles: RentalBundle[] = []
): PricingResult {
  return useMemo(() => {
    let subtotal = 0;
    let depositRequired = 0;

    items.forEach((item) => {
      let dailyRate = 0;
      let weeklyRate = 0;
      let monthlyRate = 0;
      let depositPolicy: {
        type: DepositPolicyType;
        percentage?: number;
        perUnit?: number;
      } = { type: DepositPolicyType.PERCENTAGE, percentage: 50 };

      if (item.rentalItemId) {
        const rentalItem = rentalItems.find(
          (ri) => ri.id === item.rentalItemId
        );
        if (rentalItem) {
          dailyRate = Number(rentalItem.dailyRate);
          weeklyRate = Number(rentalItem.weeklyRate);
          monthlyRate = Number(rentalItem.monthlyRate);
          depositPolicy = {
            type: rentalItem.depositPolicyType,
            percentage: Number(rentalItem.depositPercentage),
            perUnit: Number(rentalItem.depositPerUnit),
          };
        }
      } else if (item.rentalBundleId) {
        const bundle = rentalBundles.find(
          (b) => b.id === item.rentalBundleId
        );
        if (bundle) {
          dailyRate = Number(bundle.dailyRate);
          weeklyRate = Number(bundle.weeklyRate);
          monthlyRate = Number(bundle.monthlyRate);
          // Default deposit for bundles
          depositPolicy = {
            type: DepositPolicyType.PERCENTAGE,
            percentage: 50,
          };
        }
      } else {
        return;
      }

      // Calculate pricing tier - use the best rate for customer
      let unitPrice = dailyRate * rentalDays;

      if (rentalDays >= 30 && monthlyRate) {
        if (monthlyRate < unitPrice) {
          unitPrice = monthlyRate;
        }
      } else if (rentalDays >= 7 && weeklyRate) {
        const weeklyPrice = weeklyRate * Math.ceil(rentalDays / 7);
        if (weeklyPrice < unitPrice) {
          unitPrice = weeklyPrice;
        }
      }

      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      // Calculate deposit based on policy type
      if (depositPolicy.type === DepositPolicyType.PERCENTAGE) {
        depositRequired +=
          (lineTotal * Number(depositPolicy.percentage || 50)) / 100;
      } else if (depositPolicy.type === DepositPolicyType.PER_UNIT) {
        depositRequired +=
          Number(depositPolicy.perUnit || 0) * item.quantity;
      } else {
        // HYBRID: max of both
        const pctDeposit =
          (lineTotal * Number(depositPolicy.percentage || 50)) / 100;
        const unitDeposit =
          Number(depositPolicy.perUnit || 0) * item.quantity;
        depositRequired += Math.max(pctDeposit, unitDeposit);
      }
    });

    return { subtotal, depositRequired };
  }, [items, rentalItems, rentalBundles, rentalDays]);
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
