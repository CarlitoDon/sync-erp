import {
  InvoiceStatusSchema,
  OrderStatusSchema,
  DocumentStatusSchema,
  RentalOrderStatus,
} from '@sync-erp/shared';
import type { z } from 'zod';

// Types inferred from schemas
type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;
type OrderStatus = z.infer<typeof OrderStatusSchema>;
type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

/* eslint-disable @sync-erp/no-hardcoded-enum */
/* eslint-disable @sync-erp/no-hardcoded-enum */
type StatusDomain = 'invoice' | 'order' | 'document' | 'rental';
/* eslint-enable @sync-erp/no-hardcoded-enum */
/* eslint-enable @sync-erp/no-hardcoded-enum */

// Color mapping for invoice/bill statuses (exhaustive)
const invoiceStatusColors: Record<InvoiceStatus, string> = {
  DRAFT: 'border border-slate-200 bg-slate-100 text-slate-700',
  POSTED: 'border border-cyan-200 bg-cyan-50 text-cyan-800',
  PARTIALLY_PAID: 'border border-amber-200 bg-amber-50 text-amber-800',
  PAID: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  VOID: 'border border-red-200 bg-red-50 text-red-700',
};

// Color mapping for order statuses (PO/SO)
const orderStatusColors: Record<OrderStatus, string> = {
  DRAFT: 'border border-slate-200 bg-slate-100 text-slate-700',
  CONFIRMED: 'border border-cyan-200 bg-cyan-50 text-cyan-800',
  PARTIALLY_RECEIVED: 'border border-amber-200 bg-amber-50 text-amber-800',
  RECEIVED: 'border border-teal-200 bg-teal-50 text-teal-800',
  PARTIALLY_SHIPPED: 'border border-amber-200 bg-amber-50 text-amber-800',
  SHIPPED: 'border border-teal-200 bg-teal-50 text-teal-800',
  COMPLETED: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border border-red-200 bg-red-50 text-red-700',
};

// Color mapping for document statuses (GRN/Shipment)
const documentStatusColors: Record<DocumentStatus, string> = {
  DRAFT: 'border border-slate-200 bg-slate-100 text-slate-700',
  POSTED: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  VOIDED: 'border border-red-200 bg-red-50 text-red-700',
};

// Color mapping for rental statuses
const rentalStatusColors: Record<RentalOrderStatus, string> = {
  DRAFT: 'border border-slate-200 bg-slate-100 text-slate-700',
  CONFIRMED: 'border border-cyan-200 bg-cyan-50 text-cyan-800',
  ACTIVE: 'border border-teal-200 bg-teal-50 text-teal-800',
  COMPLETED: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border border-red-200 bg-red-50 text-red-700',
};

export interface StatusBadgeProps {
  status: string;
  domain?: StatusDomain;
  className?: string;
}

/**
 * Centralized status badge component with color mappings for all domains.
 *
 * @example
 * <StatusBadge status="DRAFT" domain="order" />
 * <StatusBadge status="POSTED" domain="invoice" />
 */
export function StatusBadge({
  status,
  domain = 'order',
  className = '',
}: StatusBadgeProps) {
  const getColor = (): string => {
    if (domain === 'invoice') {
      return (
        invoiceStatusColors[status as InvoiceStatus] ||
        'border border-slate-200 bg-slate-100 text-slate-700'
      );
    }
    if (domain === 'document') {
      return (
        documentStatusColors[status as DocumentStatus] ||
        'border border-slate-200 bg-slate-100 text-slate-700'
      );
    }
    if (domain === 'rental') {
      return (
        rentalStatusColors[status as RentalOrderStatus] ||
        'border border-slate-200 bg-slate-100 text-slate-700'
      );
    }
    return (
      orderStatusColors[status as OrderStatus] ||
      'border border-slate-200 bg-slate-100 text-slate-700'
    );
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getColor()} ${className}`}
    >
      {status}
    </span>
  );
}

/**
 * Helper to get status color class for external use.
 */
export function getStatusColorClass(
  status: string,
  domain: StatusDomain = 'order'
): string {
  if (domain === 'invoice') {
    return (
      invoiceStatusColors[status as InvoiceStatus] ||
      'border border-slate-200 bg-slate-100 text-slate-700'
    );
  }
  if (domain === 'document') {
    return (
      documentStatusColors[status as DocumentStatus] ||
      'border border-slate-200 bg-slate-100 text-slate-700'
    );
  }
  if (domain === 'rental') {
    return (
      rentalStatusColors[status as RentalOrderStatus] ||
      'border border-slate-200 bg-slate-100 text-slate-700'
    );
  }
  return (
    orderStatusColors[status as OrderStatus] ||
    'border border-slate-200 bg-slate-100 text-slate-700'
  );
}
