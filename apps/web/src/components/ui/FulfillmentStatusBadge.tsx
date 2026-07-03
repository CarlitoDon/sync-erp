import { OrderStatusSchema } from '@sync-erp/shared';

/* eslint-disable @sync-erp/no-hardcoded-enum */
type FulfillmentType = 'receipt' | 'shipment';
/* eslint-enable @sync-erp/no-hardcoded-enum */

interface FulfillmentStatus {
  label: string;
  color: string;
}

const receiptStatusMap: Record<string, FulfillmentStatus> = {
  [OrderStatusSchema.enum.RECEIVED]: {
    label: 'Fully Received',
<<<<<<< HEAD
    color: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  [OrderStatusSchema.enum.COMPLETED]: {
    label: 'Fully Received',
    color: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  [OrderStatusSchema.enum.PARTIALLY_RECEIVED]: {
    label: 'Partial',
    color: 'border border-amber-200 bg-amber-50 text-amber-700',
  },
  [OrderStatusSchema.enum.CONFIRMED]: {
    label: 'Pending',
    color: 'border border-cyan-200 bg-cyan-50 text-cyan-800',
  },
  [OrderStatusSchema.enum.CANCELLED]: {
    label: 'Cancelled',
    color: 'border border-red-200 bg-red-50 text-red-700',
=======
    color: 'text-green-600 bg-green-50',
  },
  [OrderStatusSchema.enum.COMPLETED]: {
    label: 'Fully Received',
    color: 'text-green-600 bg-green-50',
  },
  [OrderStatusSchema.enum.PARTIALLY_RECEIVED]: {
    label: 'Partial',
    color: 'text-amber-600 bg-amber-50',
  },
  [OrderStatusSchema.enum.CONFIRMED]: {
    label: 'Pending',
    color: 'text-blue-600 bg-blue-50',
  },
  [OrderStatusSchema.enum.CANCELLED]: {
    label: 'Cancelled',
    color: 'text-red-600 bg-red-50',
>>>>>>> origin/dev
  },
};

const shipmentStatusMap: Record<string, FulfillmentStatus> = {
  [OrderStatusSchema.enum.SHIPPED]: {
    label: 'Fully Shipped',
<<<<<<< HEAD
    color: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  [OrderStatusSchema.enum.COMPLETED]: {
    label: 'Fully Shipped',
    color: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  [OrderStatusSchema.enum.PARTIALLY_SHIPPED]: {
    label: 'Partial',
    color: 'border border-amber-200 bg-amber-50 text-amber-700',
  },
  [OrderStatusSchema.enum.CONFIRMED]: {
    label: 'Pending',
    color: 'border border-cyan-200 bg-cyan-50 text-cyan-800',
  },
  [OrderStatusSchema.enum.CANCELLED]: {
    label: 'Cancelled',
    color: 'border border-red-200 bg-red-50 text-red-700',
=======
    color: 'text-green-600 bg-green-50',
  },
  [OrderStatusSchema.enum.COMPLETED]: {
    label: 'Fully Shipped',
    color: 'text-green-600 bg-green-50',
  },
  [OrderStatusSchema.enum.PARTIALLY_SHIPPED]: {
    label: 'Partial',
    color: 'text-amber-600 bg-amber-50',
  },
  [OrderStatusSchema.enum.CONFIRMED]: {
    label: 'Pending',
    color: 'text-blue-600 bg-blue-50',
  },
  [OrderStatusSchema.enum.CANCELLED]: {
    label: 'Cancelled',
    color: 'text-red-600 bg-red-50',
>>>>>>> origin/dev
  },
};

const defaultStatus: FulfillmentStatus = {
  label: 'N/A',
<<<<<<< HEAD
  color: 'border border-slate-200 bg-slate-50 text-slate-500',
=======
  color: 'text-gray-400 bg-gray-50',
>>>>>>> origin/dev
};

export interface FulfillmentStatusBadgeProps {
  /** Order status to display */
  status: string;
  /** Type of fulfillment: 'receipt' for PO, 'shipment' for SO */
  type: FulfillmentType;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Centralized badge for order fulfillment status.
 * Maps order status to human-readable labels with appropriate colors.
 *
 * @example
 * <FulfillmentStatusBadge status={order.status} type="receipt" />
 * <FulfillmentStatusBadge status={order.status} type="shipment" />
 */
export function FulfillmentStatusBadge({
  status,
  type,
  className = '',
}: FulfillmentStatusBadgeProps) {
  const statusMap =
    type === 'receipt' ? receiptStatusMap : shipmentStatusMap;
  const { label, color } = statusMap[status] || defaultStatus;

  return (
    <span
<<<<<<< HEAD
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color} ${className}`}
=======
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color} ${className}`}
>>>>>>> origin/dev
    >
      {label}
    </span>
  );
}

/**
 * Helper to get fulfillment status for external use.
 */
export function getFulfillmentStatus(
  status: string,
  type: FulfillmentType
): FulfillmentStatus {
  const statusMap =
    type === 'receipt' ? receiptStatusMap : shipmentStatusMap;
  return statusMap[status] || defaultStatus;
}
