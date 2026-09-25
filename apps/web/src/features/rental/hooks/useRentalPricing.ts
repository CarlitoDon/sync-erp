import { useMemo } from 'react';
import { DepositPolicyType, calculateRentalDays } from '@sync-erp/shared';

interface OrderItem {
  rentalItemId?: string;
  rentalBundleId?: string;
  quantity: number | '';
  pricePerDay?: number;
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
          // Default deposit for bundles
          depositPolicy = {
            type: DepositPolicyType.PERCENTAGE,
            percentage: 50,
          };
        }
      } else {
        return;
      }

      let unitPrice = Number(item.pricePerDay || 0) * rentalDays;

      if (!item.pricePerDay) {
        unitPrice = dailyRate * rentalDays;
      }

      const qty = typeof item.quantity === 'number' ? item.quantity : Number(item.quantity) || 0;
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;

      // Calculate deposit based on policy type
      if (depositPolicy.type === DepositPolicyType.PERCENTAGE) {
        depositRequired +=
          (lineTotal * Number(depositPolicy.percentage || 50)) / 100;
      } else if (depositPolicy.type === DepositPolicyType.PER_UNIT) {
        depositRequired +=
          Number(depositPolicy.perUnit || 0) * qty;
      } else {
        // HYBRID: max of both
        const pctDeposit =
          (lineTotal * Number(depositPolicy.percentage || 50)) / 100;
        const unitDeposit =
          Number(depositPolicy.perUnit || 0) * qty;
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
    return calculateRentalDays(startDate, endDate);
  }, [startDate, endDate]);
}

/**
 * Get pricing tier label based on rental duration.
 */
export function getPricingTierLabel(_rentalDays: number): string {
  return 'tarif harian';
}

export interface LineTotalCalculation {
  unitPrice: number;
  lineTotal: number;
  dailyRate: number;
  name: string;
}

/**
 * Calculate single line total for preview invoice or receipt display.
 */
export function calculateLineTotal(
  item: OrderItem,
  rentalItems: { id: string; dailyRate: unknown; weeklyRate?: unknown; monthlyRate?: unknown; product?: { name?: string } }[],
  rentalBundles: { id: string; name?: string; dailyRate: unknown; weeklyRate?: unknown; monthlyRate?: unknown }[],
  rentalDays: number
): LineTotalCalculation {
  let dailyRate = 0;
  let name = 'Item';

  if (item.rentalItemId) {
    const ri = rentalItems.find((r) => r.id === item.rentalItemId);
    if (ri) {
      name = ri.product?.name || 'Item';
      dailyRate = Number(ri.dailyRate) || 0;
    }
  } else if (item.rentalBundleId) {
    const rb = rentalBundles.find((b) => b.id === item.rentalBundleId);
    if (rb) {
      name = rb.name || 'Paket Bundle';
      dailyRate = Number(rb.dailyRate) || 0;
    }
  }

  let unitPrice = Number(item.pricePerDay || 0) * rentalDays;
  if (!item.pricePerDay) {
    unitPrice = dailyRate * rentalDays;
  }

  const qty = typeof item.quantity === 'number' ? item.quantity : Number(item.quantity) || 0;
  const lineTotal = unitPrice * qty;

  return { unitPrice, lineTotal, dailyRate, name };
}

