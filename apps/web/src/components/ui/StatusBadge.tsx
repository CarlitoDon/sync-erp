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
<<<<<<< HEAD
  DRAFT: 'border border-slate-200 bg-slate-100 text-slate-700',
  POSTED: 'border border-cyan-200 bg-cyan-50 text-cyan-800',
  PARTIALLY_PAID: 'border border-amber-200 bg-amber-50 text-amber-800',
  PAID: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  VOID: 'border border-red-200 bg-red-50 text-red-700',
=======
  DRAFT: 'bg-gray-100 text-gray-800',
  POSTED: 'bg-blue-100 text-blue-800',
  PARTIALLY_PAID: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  VOID: 'bg-red-100 text-red-800',
>>>>>>> origin/dev
};

// Color mapping for order statuses (PO/SO)
const orderStatusColors: Record<OrderStatus, string> = {
<<<<<<< HEAD
  DRAFT: 'border border-slate-200 bg-slate-100 text-slate-700',
  CONFIRMED: 'border border-cyan-200 bg-cyan-50 text-cyan-800',
  PARTIALLY_RECEIVED: 'border border-amber-200 bg-amber-50 text-amber-800',
  RECEIVED: 'border border-teal-200 bg-teal-50 text-teal-800',
  PARTIALLY_SHIPPED: 'border border-amber-200 bg-amber-50 text-amber-800',
  SHIPPED: 'border border-teal-200 bg-teal-50 text-teal-800',
  COMPLETED: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border border-red-200 bg-red-50 text-red-700',
=======
  DRAFT: 'bg-gray-100 text-gray-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PARTIALLY_RECEIVED: 'bg-amber-100 text-amber-800',
  RECEIVED: 'bg-teal-100 text-teal-800',
  PARTIALLY_SHIPPED: 'bg-amber-100 text-amber-800',
  SHIPPED: 'bg-teal-100 text-teal-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
>>>>>>> origin/dev
};

// Color mapping for document statuses (GRN/Shipment)
const documentStatusColors: Record<DocumentStatus, string> = {
<<<<<<< HEAD
  DRAFT: 'border border-slate-200 bg-slate-100 text-slate-700',
  POSTED: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  VOIDED: 'border border-red-200 bg-red-50 text-red-700',
=======
  DRAFT: 'bg-gray-100 text-gray-800',
  POSTED: 'bg-green-100 text-green-800',
  VOIDED: 'bg-red-100 text-red-800',
>>>>>>> origin/dev
};

// Color mapping for rental statuses
const rentalStatusColors: Record<RentalOrderStatus, string> = {
<<<<<<< HEAD
  DRAFT: 'border border-slate-200 bg-slate-100 text-slate-700',
  CONFIRMED: 'border border-cyan-200 bg-cyan-50 text-cyan-800',
  ACTIVE: 'border border-teal-200 bg-teal-50 text-teal-800',
  COMPLETED: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border border-red-200 bg-red-50 text-red-700',
=======
  DRAFT: 'bg-gray-100 text-gray-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
>>>>>>> origin/dev
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
<<<<<<< HEAD
        'border border-slate-200 bg-slate-100 text-slate-700'
=======
        'bg-gray-100 text-gray-800'
>>>>>>> origin/dev
      );
    }
    if (domain === 'document') {
      return (
        documentStatusColors[status as DocumentStatus] ||
<<<<<<< HEAD
        'border border-slate-200 bg-slate-100 text-slate-700'
=======
        'bg-gray-100 text-gray-800'
>>>>>>> origin/dev
      );
    }
    if (domain === 'rental') {
      return (
        rentalStatusColors[status as RentalOrderStatus] ||
<<<<<<< HEAD
        'border border-slate-200 bg-slate-100 text-slate-700'
=======
        'bg-gray-100 text-gray-800'
>>>>>>> origin/dev
      );
    }
    return (
      orderStatusColors[status as OrderStatus] ||
<<<<<<< HEAD
      'border border-slate-200 bg-slate-100 text-slate-700'
=======
      'bg-gray-100 text-gray-800'
>>>>>>> origin/dev
    );
  };

  return (
    <span
<<<<<<< HEAD
      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getColor()} ${className}`}
=======
      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getColor()} ${className}`}
>>>>>>> origin/dev
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
<<<<<<< HEAD
      'border border-slate-200 bg-slate-100 text-slate-700'
=======
      'bg-gray-100 text-gray-800'
>>>>>>> origin/dev
    );
  }
  if (domain === 'document') {
    return (
      documentStatusColors[status as DocumentStatus] ||
<<<<<<< HEAD
      'border border-slate-200 bg-slate-100 text-slate-700'
=======
      'bg-gray-100 text-gray-800'
>>>>>>> origin/dev
    );
  }
  if (domain === 'rental') {
    return (
      rentalStatusColors[status as RentalOrderStatus] ||
<<<<<<< HEAD
      'border border-slate-200 bg-slate-100 text-slate-700'
=======
      'bg-gray-100 text-gray-800'
>>>>>>> origin/dev
    );
  }
  return (
    orderStatusColors[status as OrderStatus] ||
<<<<<<< HEAD
    'border border-slate-200 bg-slate-100 text-slate-700'
=======
    'bg-gray-100 text-gray-800'
>>>>>>> origin/dev
  );
}
