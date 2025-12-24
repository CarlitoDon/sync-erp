import {
  InvoiceStatusSchema,
  OrderStatusSchema,
} from '@sync-erp/shared';
import type { z } from 'zod';

// Types inferred from schemas
type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;
type OrderStatus = z.infer<typeof OrderStatusSchema>;

/* eslint-disable @sync-erp/no-hardcoded-enum */
type StatusDomain = 'invoice' | 'order';
/* eslint-enable @sync-erp/no-hardcoded-enum */

// Color mapping for invoice/bill statuses (exhaustive)
const invoiceStatusColors: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  POSTED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  VOID: 'bg-red-100 text-red-800',
};

// Color mapping for order statuses (PO/SO)
const orderStatusColors: Record<OrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PARTIALLY_RECEIVED: 'bg-amber-100 text-amber-800',
  RECEIVED: 'bg-teal-100 text-teal-800',
  PARTIALLY_SHIPPED: 'bg-amber-100 text-amber-800',
  SHIPPED: 'bg-teal-100 text-teal-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
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
        'bg-gray-100 text-gray-800'
      );
    }
    return (
      orderStatusColors[status as OrderStatus] ||
      'bg-gray-100 text-gray-800'
    );
  };

  return (
    <span
      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getColor()} ${className}`}
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
      'bg-gray-100 text-gray-800'
    );
  }
  return (
    orderStatusColors[status as OrderStatus] ||
    'bg-gray-100 text-gray-800'
  );
}
