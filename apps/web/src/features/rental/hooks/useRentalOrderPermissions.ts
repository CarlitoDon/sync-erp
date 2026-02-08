import {
  RentalOrderStatus,
  RentalPaymentStatus,
  OrderSource,
} from '@sync-erp/shared';

interface RentalOrderForPermissions {
  status: string;
  rentalPaymentStatus?: string | null;
  orderSource?: string | null;
}

export interface RentalOrderPermissions {
  // Status flags
  isDraft: boolean;
  isConfirmed: boolean;
  isActive: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
  isWebsiteOrder: boolean;
  isAwaitingPaymentVerification: boolean;

  // Action permissions
  canConfirm: boolean;
  canRelease: boolean;
  canReturn: boolean;
  canCancel: boolean;
  canVerifyPayment: boolean;
}

/**
 * Hook to centralize permission logic for rental orders.
 */
export function useRentalOrderPermissions(
  order: RentalOrderForPermissions | null | undefined
): RentalOrderPermissions {
  if (!order) {
    return {
      isDraft: false,
      isConfirmed: false,
      isActive: false,
      isCompleted: false,
      isCancelled: false,
      isWebsiteOrder: false,
      isAwaitingPaymentVerification: false,
      canConfirm: false,
      canRelease: false,
      canReturn: false,
      canCancel: false,
      canVerifyPayment: false,
    };
  }

  // Status flags
  const isDraft = order.status === RentalOrderStatus.DRAFT;
  const isConfirmed = order.status === RentalOrderStatus.CONFIRMED;
  const isActive = order.status === RentalOrderStatus.ACTIVE;
  const isCompleted = order.status === RentalOrderStatus.COMPLETED;
  const isCancelled = order.status === RentalOrderStatus.CANCELLED;
  const isWebsiteOrder = order.orderSource === OrderSource.WEBSITE;
  const isAwaitingPaymentVerification =
    order.rentalPaymentStatus ===
    RentalPaymentStatus.AWAITING_CONFIRM;

  // Action permissions
  const canConfirm = isDraft;
  const canRelease = isConfirmed;
  const canReturn = isActive;
  const canCancel = isDraft;
  const canVerifyPayment =
    isWebsiteOrder && isAwaitingPaymentVerification;

  return {
    isDraft,
    isConfirmed,
    isActive,
    isCompleted,
    isCancelled,
    isWebsiteOrder,
    isAwaitingPaymentVerification,
    canConfirm,
    canRelease,
    canReturn,
    canCancel,
    canVerifyPayment,
  };
}
