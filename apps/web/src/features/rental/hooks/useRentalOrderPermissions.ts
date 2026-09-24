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
  canEdit: boolean;
  canConfirm: boolean;
  canRelease: boolean;
  canReturn: boolean;
  canCancel: boolean;
  canVerifyPayment: boolean;
  canExtend: boolean;
  canConvertOverdue: boolean;
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
      canEdit: false,
      canConfirm: false,
      canRelease: false,
      canReturn: false,
      canCancel: false,
      canVerifyPayment: false,
      canExtend: false,
      canConvertOverdue: false,
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
  const canEdit = isDraft;
  const canConfirm = isDraft;
  const canRelease = isConfirmed;
  const canReturn = isActive;
  const canCancel = isDraft;
  const canVerifyPayment =
    isWebsiteOrder &&
    (isAwaitingPaymentVerification ||
      order.rentalPaymentStatus === RentalPaymentStatus.PENDING);
  // T031/T034: extension (full/partial) & overdue daily conversion
  const canExtend = isConfirmed || isActive;
  const canConvertOverdue = isActive;

  return {
    isDraft,
    isConfirmed,
    isActive,
    isCompleted,
    isCancelled,
    isWebsiteOrder,
    isAwaitingPaymentVerification,
    canEdit,
    canConfirm,
    canRelease,
    canReturn,
    canCancel,
    canVerifyPayment,
    canExtend,
    canConvertOverdue,
  };
}
