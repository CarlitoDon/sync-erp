import { PaymentTermsSchema } from '@sync-erp/shared';
import { DecimalLike, toNumber } from '@/types/decimal';

interface PurchaseOrderForCalculations {
  totalAmount: DecimalLike;
  taxRate?: DecimalLike;
  paymentTerms?: string | null;
  dpAmount?: DecimalLike;
  dpPercent?: DecimalLike;
  paymentStatus?: string | null;
  computed?: {
    hasDpRequired?: boolean;
    isDpPaid?: boolean;
    actualDpPercent?: number;
    actualDpAmount?: number;
    totalBilled?: number;
    outstanding?: number;
    dpBillId?: string | null;
  };
}

interface PurchaseOrderCalculations {
  // Base amounts
  totalAmount: number;
  taxRate: number;
  subtotal: number;
  taxAmount: number;

  // DP breakdown
  isUpfrontOrder: boolean;
  hasDpRequired: boolean;
  isDpPaid: boolean;
  dpPercent: number;
  dpAmount: number;
  remainingAfterDp: number;

  // Billing summary
  totalBilled: number;
  outstanding: number;
  dpBillId: string | null;
}

/**
 * Hook to compute all financial calculations for a Purchase Order.
 * Centralizes the price breakdown logic.
 */
export function usePurchaseOrderCalculations(
  order: PurchaseOrderForCalculations | null | undefined
): PurchaseOrderCalculations {
  if (!order) {
    return {
      totalAmount: 0,
      taxRate: 0,
      subtotal: 0,
      taxAmount: 0,
      isUpfrontOrder: false,
      hasDpRequired: false,
      isDpPaid: false,
      dpPercent: 0,
      dpAmount: 0,
      remainingAfterDp: 0,
      totalBilled: 0,
      outstanding: 0,
      dpBillId: null,
    };
  }

  const totalAmount = toNumber(order.totalAmount);
  const taxRate = toNumber(order.taxRate);

  // Calculate subtotal (reverse from total if tax is included)
  const subtotal =
    taxRate > 0 ? totalAmount / (1 + taxRate / 100) : totalAmount;
  const taxAmount = totalAmount - subtotal;

  // Payment terms
  const isUpfrontOrder =
    order.paymentTerms === PaymentTermsSchema.enum.UPFRONT;

  // DP breakdown - prefer computed values if available
  const hasDpRequired = order.computed?.hasDpRequired ?? false;
  const isDpPaid = order.computed?.isDpPaid ?? false;
  const dpPercent =
    order.computed?.actualDpPercent ?? toNumber(order.dpPercent);
  const dpAmount =
    order.computed?.actualDpAmount ?? toNumber(order.dpAmount);
  const remainingAfterDp = totalAmount - dpAmount;

  // Billing summary
  const totalBilled = order.computed?.totalBilled ?? 0;
  const outstanding = order.computed?.outstanding ?? 0;
  const dpBillId = order.computed?.dpBillId ?? null;

  return {
    totalAmount,
    taxRate,
    subtotal,
    taxAmount,
    isUpfrontOrder,
    hasDpRequired,
    isDpPaid,
    dpPercent,
    dpAmount,
    remainingAfterDp,
    totalBilled,
    outstanding,
    dpBillId,
  };
}
