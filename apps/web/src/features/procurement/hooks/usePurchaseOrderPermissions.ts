import {
  OrderStatusSchema,
  PaymentTermsSchema,
  PaymentStatusSchema,
  InvoiceStatusSchema,
  DocumentStatusSchema,
} from '@sync-erp/shared';
import { DecimalLike } from '@/types/decimal';

interface PurchaseOrderForPermissions {
  id: string;
  status: string;
  paymentTerms?: string | null;
  paymentStatus?: string | null;
  dpAmount?: DecimalLike;
  paidAmount?: DecimalLike;
  invoices?: {
    id: string;
    status: string;
    notes?: string | null;
    balance: DecimalLike;
    isDownPayment?: boolean;
  }[];
  fulfillments?: {
    id: string;
    status: string;
    number: string;
  }[];
}

interface PurchaseOrderPermissions {
  // Status Flags
  isDraft: boolean;
  isConfirmed: boolean;
  isPartiallyReceived: boolean;
  isReceived: boolean;
  isCompleted: boolean;
  isCancelled: boolean;

  // Payment Flags
  isUpfront: boolean;
  isPaidUpfront: boolean;
  hasDpRequired: boolean;
  isDpPaid: boolean;

  // Action Permissions
  canConfirm: boolean;
  canCancel: boolean;
  canReceiveGoods: boolean;
  canCreateBill: boolean;
  canCreateDpBill: boolean;
  canClose: boolean;

  dpBill: PurchaseOrderForPermissions['invoices'] extends
    | (infer T)[]
    | undefined
    ? T | null
    : never;
  finalBill: PurchaseOrderForPermissions['invoices'] extends
    | (infer T)[]
    | undefined
    ? T | null
    : never;
  draftGRN: PurchaseOrderForPermissions['fulfillments'] extends
    | (infer T)[]
    | undefined
    ? T | null
    : never;
  postedGRN: PurchaseOrderForPermissions['fulfillments'] extends
    | (infer T)[]
    | undefined
    ? T | null
    : never;

  // Derived
  requiresPrepaymentWarning: boolean;
}

/**
 * Hook to compute all permission flags for a Purchase Order.
 * Centralizes the complex boolean logic for action visibility.
 */
export function usePurchaseOrderPermissions(
  order: PurchaseOrderForPermissions | null | undefined
): PurchaseOrderPermissions {
  if (!order) {
    return {
      isDraft: false,
      isConfirmed: false,
      isPartiallyReceived: false,
      isReceived: false,
      isCompleted: false,
      isCancelled: false,
      isUpfront: false,
      isPaidUpfront: false,
      hasDpRequired: false,
      isDpPaid: false,
      canConfirm: false,
      canCancel: false,
      canReceiveGoods: false,
      canCreateBill: false,
      canCreateDpBill: false,
      canClose: false,
      dpBill: null,
      finalBill: null,
      draftGRN: null,
      postedGRN: null,
      requiresPrepaymentWarning: false,
    };
  }

  // --- Status Flags ---
  const isDraft = order.status === OrderStatusSchema.enum.DRAFT;
  const isConfirmed =
    order.status === OrderStatusSchema.enum.CONFIRMED;
  const isPartiallyReceived =
    order.status === OrderStatusSchema.enum.PARTIALLY_RECEIVED;
  const isReceived = order.status === OrderStatusSchema.enum.RECEIVED;
  const isCompleted =
    order.status === OrderStatusSchema.enum.COMPLETED;
  const isCancelled =
    order.status === OrderStatusSchema.enum.CANCELLED;

  // --- Payment Flags ---
  const isUpfront =
    order.paymentTerms === PaymentTermsSchema.enum.UPFRONT;
  const isPaidUpfront =
    order.paymentStatus === PaymentStatusSchema.enum.PAID_UPFRONT;

  const dpAmount = order.dpAmount ? Number(order.dpAmount) : 0;
  const paidAmount = order.paidAmount ? Number(order.paidAmount) : 0;
  const hasDpRequired = isUpfront || dpAmount > 0;

  // Find DP Bill
  const dpBill =
    order.invoices?.find(
      (inv) =>
        inv.isDownPayment || inv.notes?.includes('Down Payment')
    ) || null;
  const isDpPaid = dpBill?.status === InvoiceStatusSchema.enum.PAID;

  // Find Final Bill (non-DP)
  const finalBills = order.invoices?.filter(
    (inv) =>
      !inv.isDownPayment && !inv.notes?.includes('Down Payment')
  );
  const finalBill =
    finalBills && finalBills.length > 0 ? finalBills[0] : null;

  // Find GRNs
  const draftGRN =
    order.fulfillments?.find(
      (f) => f.status === DocumentStatusSchema.enum.DRAFT
    ) || null;
  const postedGRN =
    order.fulfillments?.find(
      (f) => f.status === DocumentStatusSchema.enum.POSTED
    ) || null;
  const hasDraftGRN = !!draftGRN;

  // --- Action Permissions ---
  const canConfirm = isDraft;
  const canCancel = isDraft;

  // Block receive if DP required and not paid, OR if there's already a draft GRN
  const canReceiveGoods =
    (isConfirmed || isPartiallyReceived) &&
    (!hasDpRequired || isPaidUpfront || paidAmount > 0 || isDpPaid) &&
    !hasDraftGRN;

  // Only show Create Bill for final bill (after GRN), not DP Bill
  const canCreateBill =
    (isReceived || isPartiallyReceived || isCompleted) && !finalBill;

  // Create DP Bill: if CONFIRMED, has DP requirement, and no DP Bill yet
  const canCreateDpBill = isConfirmed && hasDpRequired && !dpBill;

  // Allow closing partially received POs
  const canClose = isConfirmed || isPartiallyReceived;

  // Prepayment warning for UPFRONT orders
  const requiresPrepaymentWarning =
    isUpfront && !isPaidUpfront && !isDraft && !isCancelled;

  return {
    isDraft,
    isConfirmed,
    isPartiallyReceived,
    isReceived,
    isCompleted,
    isCancelled,
    isUpfront,
    isPaidUpfront,
    hasDpRequired,
    isDpPaid,
    canConfirm,
    canCancel,
    canReceiveGoods,
    canCreateBill,
    canCreateDpBill,
    canClose,
    dpBill,
    finalBill,
    draftGRN,
    postedGRN,
    requiresPrepaymentWarning,
  };
}
