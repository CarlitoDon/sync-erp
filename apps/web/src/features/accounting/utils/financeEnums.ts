/**
 * Finance Enums Utility
 *
 * Import enums from shared schema - never hardcode enum values in UI.
 * This file provides type-safe options for Select components and label mappings.
 */
import { InvoiceStatusSchema } from '@/types/api';
import { PaymentMethodTypeSchema } from '@sync-erp/shared';
import { formatCompact } from '@/types/decimal';
import { z } from 'zod';

// Types inferred from schemas (source of truth)
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodTypeSchema>;

// ============================================
// Payment Method Options (for Select components)
// ============================================

// Label mapping - exhaustive, will error if schema changes
const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  BANK: 'Bank Transfer',
  QRIS: 'QRIS',
  EWALLET: 'E-Wallet',
  OTHER: 'Other',
};

// Generate options from schema
export const paymentMethodOptions =
  PaymentMethodTypeSchema.options.map((value) => ({
    value,
    label: paymentMethodLabels[value],
  }));

// Default value
export const defaultPaymentMethod: PaymentMethod = 'BANK';

// ============================================
// Invoice Status Options (for filters/tabs)
// ============================================

// Label mapping - exhaustive
const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  POSTED: 'Posted',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  VOID: 'Void',
};

// Color mapping for status badges - exhaustive
const invoiceStatusColors: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  POSTED: 'bg-blue-100 text-blue-800',
  PARTIALLY_PAID: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  VOID: 'bg-red-100 text-red-800',
};

// Generate options from schema
export const invoiceStatusOptions = InvoiceStatusSchema.options.map(
  (value) => ({
    value,
    label: invoiceStatusLabels[value],
  })
);

// Filter options (includes 'ALL')
export const invoiceStatusFilterOptions = [
  { value: 'ALL' as const, label: 'All' },
  ...invoiceStatusOptions,
];

export type InvoiceStatusFilter = InvoiceStatus | 'ALL';

// Helper to get status display
export function getInvoiceStatusDisplay(status: InvoiceStatus) {
  return {
    label: invoiceStatusLabels[status],
    color: invoiceStatusColors[status],
  };
}

// For Posted check (UI conditional, not business logic)
export function isPosted(status: InvoiceStatus): boolean {
  return status === InvoiceStatusSchema.enum.POSTED;
}

export function isDraft(status: InvoiceStatus): boolean {
  return status === InvoiceStatusSchema.enum.DRAFT;
}

export function hasBalance(
  status: InvoiceStatus,
  balance: number
): boolean {
  return isPosted(status) && balance > 0;
}

// ============================================
// Bill Status Options (same as Invoice status)
// ============================================
// Bill uses same status as Invoice, so we reuse InvoiceStatus types
export const getBillStatusDisplay = getInvoiceStatusDisplay;
export type BillStatus = InvoiceStatus;

// ============================================
// Status Badge Helpers (with balance display)
// ============================================

/**
 * Get invoice status badge with optional balance display.
 */
export function getInvoiceStatusBadge(
  status: string,
  balance?: number | null
) {
  const numBalance = balance ?? 0;

  switch (status) {
    case InvoiceStatusSchema.enum.PAID:
      return {
        color: 'bg-green-100 text-green-800',
        label: '✓ Paid',
      };
    case InvoiceStatusSchema.enum.POSTED:
      return {
        color: 'bg-yellow-100 text-yellow-800',
        label:
          numBalance > 0
            ? `○ Rp ${formatCompact(numBalance)}`
            : '○ Posted',
      };
    case InvoiceStatusSchema.enum.PARTIALLY_PAID:
      return {
        color: 'bg-blue-100 text-blue-800',
        label:
          numBalance > 0
            ? `◐ Rp ${formatCompact(numBalance)}`
            : '◐ Partial',
      };
    case InvoiceStatusSchema.enum.VOID:
      return { color: 'bg-red-100 text-red-800', label: '✕ Void' };
    default:
      return { color: 'bg-gray-100 text-gray-600', label: '◌ Draft' };
  }
}

/**
 * Get bill status badge with optional balance display.
 * (Bills use same status as invoices)
 */
export const getBillStatusBadge = getInvoiceStatusBadge;
