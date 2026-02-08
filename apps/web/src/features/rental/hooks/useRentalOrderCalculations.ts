import { DecimalLike, toNumber } from '@/types/decimal';

interface RentalOrderItem {
  quantity: number;
  rentalBundleId?: string | null;
  rentalBundle?: {
    components?: unknown[];
  } | null;
}

interface RentalOrderForCalculations {
  rentalStartDate: Date | string;
  rentalEndDate: Date | string;
  subtotal: DecimalLike;
  discountAmount?: DecimalLike;
  deliveryFee?: DecimalLike;
  totalAmount: DecimalLike;
  depositAmount: DecimalLike;
  discountLabel?: string | null;
  items: RentalOrderItem[];
  unitAssignments?: unknown[];
}

export interface RentalOrderCalculations {
  // Duration
  durationDays: number;
  startDayName: string;
  endDayName: string;

  // Units
  assignedUnitsCount: number;
  totalUnitsRequired: number;

  // Financial
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  depositAmount: number;
  netOutstanding: number;
  hasDiscount: boolean;
  hasDeliveryFee: boolean;
  discountLabel: string | null;
}

/**
 * Hook to compute calculations for a rental order.
 */
export function useRentalOrderCalculations(
  order: RentalOrderForCalculations | null | undefined
): RentalOrderCalculations {
  if (!order) {
    return {
      durationDays: 0,
      startDayName: '',
      endDayName: '',
      assignedUnitsCount: 0,
      totalUnitsRequired: 0,
      subtotal: 0,
      discountAmount: 0,
      deliveryFee: 0,
      totalAmount: 0,
      depositAmount: 0,
      netOutstanding: 0,
      hasDiscount: false,
      hasDeliveryFee: false,
      discountLabel: null,
    };
  }

  // Duration calculation
  const startDate = new Date(order.rentalStartDate);
  const endDate = new Date(order.rentalEndDate);
  const durationDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const startDayName = startDate.toLocaleDateString('id-ID', {
    weekday: 'long',
  });
  const endDayName = endDate.toLocaleDateString('id-ID', {
    weekday: 'long',
  });

  // Unit calculations
  const assignedUnitsCount = order.unitAssignments?.length ?? 0;
  const totalUnitsRequired = order.items.reduce((sum, item) => {
    if (item.rentalBundleId && item.rentalBundle?.components) {
      return (
        sum + item.rentalBundle.components.length * item.quantity
      );
    }
    return sum + item.quantity;
  }, 0);

  // Financial calculations
  const subtotal = toNumber(order.subtotal);
  const discountAmount = toNumber(order.discountAmount);
  const deliveryFee = toNumber(order.deliveryFee);
  const totalAmount = toNumber(order.totalAmount);
  const depositAmount = toNumber(order.depositAmount);
  const netOutstanding = totalAmount - depositAmount;

  return {
    durationDays,
    startDayName,
    endDayName,
    assignedUnitsCount,
    totalUnitsRequired,
    subtotal,
    discountAmount,
    deliveryFee,
    totalAmount,
    depositAmount,
    netOutstanding,
    hasDiscount: discountAmount > 0,
    hasDeliveryFee: deliveryFee > 0,
    discountLabel: order.discountLabel ?? null,
  };
}
