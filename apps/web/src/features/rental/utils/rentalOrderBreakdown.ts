export interface OrderBreakdownDiscount {
  id?: string;
  label: string;
  type?: 'FIXED' | 'PERCENTAGE';
  value?: number;
  amount: number;
}

export interface RentalOrderFinancialBreakdown {
  subtotal: number;
  baseDeliveryFee: number;
  upstairsCount: number;
  upstairsFeePerUnit: number;
  upstairsTotalFee: number;
  fittedSheetCount: number;
  fittedSheetFeePerUnit: number;
  fittedSheetTotalFee: number;
  discounts: OrderBreakdownDiscount[];
  totalDiscountAmount: number;
  totalAmount: number;
  depositAmount: number;
  remainingBalance: number;
  isFullyPaid: boolean;
}

export type NumericLike =
  | number
  | string
  | { toString(): string; toNumber?: () => number }
  | null
  | undefined;

export function toNumericValue(val: NumericLike): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return Number.isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    const num = Number(val);
    return Number.isNaN(num) ? 0 : num;
  }
  if (typeof val === 'object') {
    if ('toNumber' in val && typeof val.toNumber === 'function') {
      const num = val.toNumber();
      return Number.isNaN(num) ? 0 : num;
    }
    const num = Number(val.toString());
    return Number.isNaN(num) ? 0 : num;
  }
  return 0;
}

interface OrderItemLike {
  subtotal?: NumericLike;
}

export interface RentalOrderLike {
  subtotal?: NumericLike;
  totalAmount?: NumericLike;
  deliveryFee?: NumericLike;
  depositAmount?: NumericLike;
  discountAmount?: NumericLike;
  discountLabel?: string | null;
  notes?: string | null;
  policySnapshot?: unknown;
  items?: OrderItemLike[] | null;
}

interface PolicySnapshotData {
  upstairsFeePerUnit?: number;
  fittedSheetFeePerUnit?: number;
  upstairsMattressCount?: number;
  fittedSheetCount?: number;
  discounts?: Array<{
    id?: string;
    label?: string;
    type?: 'FIXED' | 'PERCENTAGE';
    value?: number;
    amount?: number;
  }>;
}

function parsePolicySnapshotData(raw: unknown): PolicySnapshotData | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const result: PolicySnapshotData = {};

  if (typeof obj.upstairsFeePerUnit === 'number') {
    result.upstairsFeePerUnit = obj.upstairsFeePerUnit;
  }
  if (typeof obj.fittedSheetFeePerUnit === 'number') {
    result.fittedSheetFeePerUnit = obj.fittedSheetFeePerUnit;
  }
  if (typeof obj.upstairsMattressCount === 'number') {
    result.upstairsMattressCount = obj.upstairsMattressCount;
  }
  if (typeof obj.fittedSheetCount === 'number') {
    result.fittedSheetCount = obj.fittedSheetCount;
  }
  if (Array.isArray(obj.discounts)) {
    result.discounts = [];
    for (const d of obj.discounts) {
      if (d && typeof d === 'object') {
        const item = d as Record<string, unknown>;
        const amount = typeof item.amount === 'number' ? item.amount : 0;
        const label =
          typeof item.label === 'string' && item.label.trim()
            ? item.label.trim()
            : 'Diskon';
        const type =
          item.type === 'PERCENTAGE' || item.type === 'FIXED'
            ? item.type
            : undefined;
        const value = typeof item.value === 'number' ? item.value : undefined;
        const id = typeof item.id === 'string' ? item.id : undefined;
        result.discounts.push({ id, label, type, value, amount });
      }
    }
  }
  return result;
}

/**
 * Calculates a comprehensive financial breakdown for a rental order.
 * Extracted from subtotal, delivery fee, special logistical services (upstairs/fitted sheets)
 * recorded in notes or policySnapshot, discounts, total bill, and down payment.
 */
export function calculateRentalOrderBreakdown(
  order: RentalOrderLike | null | undefined,
  depositInput?: number | null
): RentalOrderFinancialBreakdown {
  if (!order) {
    return {
      subtotal: 0,
      baseDeliveryFee: 0,
      upstairsCount: 0,
      upstairsFeePerUnit: 3500,
      upstairsTotalFee: 0,
      fittedSheetCount: 0,
      fittedSheetFeePerUnit: 2000,
      fittedSheetTotalFee: 0,
      discounts: [],
      totalDiscountAmount: 0,
      totalAmount: 0,
      depositAmount: 0,
      remainingBalance: 0,
      isFullyPaid: false,
    };
  }

  const notesText = order.notes || '';
  const policySnap = parsePolicySnapshotData(order.policySnapshot);

  // 1. Upstairs Mattress Service (Layanan Naik Lantai Atas)
  const upstairsMatch = notesText.match(
    /(?:kasur\s+)?naik(?:\s+ke)?\s+lantai(?:\s*(?:atas|\d+))?:\s*(\d+)/i
  );
  const upstairsCount = upstairsMatch
    ? Number(upstairsMatch[1])
    : (policySnap?.upstairsMattressCount ?? 0);

  const upstairsFeePerUnit = policySnap?.upstairsFeePerUnit ?? 3500;
  const upstairsTotalFee = upstairsCount * upstairsFeePerUnit;

  // 2. Fitted Sheet Service (Layanan Pasang Sprei)
  const fittedMatch = notesText.match(
    /(?:kasur\s+)?(?:dipasang|pasang)\s+sprei(?:nya)?:\s*(\d+)/i
  );
  const fittedSheetCount = fittedMatch
    ? Number(fittedMatch[1])
    : (policySnap?.fittedSheetCount ?? 0);

  const fittedSheetFeePerUnit = policySnap?.fittedSheetFeePerUnit ?? 2000;
  const fittedSheetTotalFee = fittedSheetCount * fittedSheetFeePerUnit;

  // 3. Base Delivery Fee (Ongkos Kirim Dasar)
  const baseDeliveryMatch = notesText.match(
    /ongkos kirim dasar:\s*rp\s*([\d.]+)/i
  );
  let baseDeliveryFee = 0;
  if (baseDeliveryMatch) {
    baseDeliveryFee = Number(baseDeliveryMatch[1].replace(/\./g, ''));
  } else if (order.deliveryFee !== null && order.deliveryFee !== undefined) {
    const totalDeliv = toNumericValue(order.deliveryFee);
    baseDeliveryFee = Math.max(
      0,
      totalDeliv - upstairsTotalFee - fittedSheetTotalFee
    );
  }

  // 4. Discounts (Diskon / Potongan Harga)
  let discounts: OrderBreakdownDiscount[] = [];
  if (policySnap?.discounts && policySnap.discounts.length > 0) {
    discounts = policySnap.discounts.map((d) => ({
      id: d.id,
      label: d.label || 'Diskon',
      type: d.type,
      value: d.value,
      amount: d.amount || 0,
    }));
  } else if (
    order.discountAmount !== null &&
    order.discountAmount !== undefined &&
    toNumericValue(order.discountAmount) > 0
  ) {
    const discAmt = toNumericValue(order.discountAmount);
    discounts = [
      {
        id: 'discount-main',
        label: order.discountLabel || 'Diskon',
        type: 'FIXED',
        value: discAmt,
        amount: discAmt,
      },
    ];
  }
  const totalDiscountAmount = discounts.reduce((sum, d) => sum + d.amount, 0);

  // 5. Total and Subtotal
  const rawTotalAmount = toNumericValue(order.totalAmount);
  const itemsSubtotal = (order.items || []).reduce(
    (sum, it) => sum + toNumericValue(it.subtotal),
    0
  );
  const rawSubtotal = toNumericValue(order.subtotal);
  const subtotal =
    rawSubtotal > 0
      ? rawSubtotal
      : itemsSubtotal > 0
        ? itemsSubtotal
        : Math.max(
            0,
            rawTotalAmount -
              baseDeliveryFee -
              upstairsTotalFee -
              fittedSheetTotalFee +
              totalDiscountAmount
          );

  const totalAmount =
    rawTotalAmount > 0
      ? rawTotalAmount
      : Math.max(
          0,
          subtotal +
            baseDeliveryFee +
            upstairsTotalFee +
            fittedSheetTotalFee -
            totalDiscountAmount
        );

  // 6. Down Payment & Remaining Balance
  const effectiveDeposit =
    depositInput !== undefined && depositInput !== null
      ? Number(depositInput)
      : toNumericValue(order.depositAmount);
  const depositAmount = Math.max(0, effectiveDeposit);
  const remainingBalance = Math.max(0, totalAmount - depositAmount);
  const isFullyPaid = depositAmount >= totalAmount && totalAmount > 0;

  return {
    subtotal,
    baseDeliveryFee,
    upstairsCount,
    upstairsFeePerUnit,
    upstairsTotalFee,
    fittedSheetCount,
    fittedSheetFeePerUnit,
    fittedSheetTotalFee,
    discounts,
    totalDiscountAmount,
    totalAmount,
    depositAmount,
    remainingBalance,
    isFullyPaid,
  };
}
