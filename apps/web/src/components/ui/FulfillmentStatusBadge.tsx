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
  },
};

const shipmentStatusMap: Record<string, FulfillmentStatus> = {
  [OrderStatusSchema.enum.SHIPPED]: {
    label: 'Fully Shipped',
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
  },
};

const defaultStatus: FulfillmentStatus = {
  label: 'N/A',
  color: 'text-gray-400 bg-gray-50',
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
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color} ${className}`}
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
