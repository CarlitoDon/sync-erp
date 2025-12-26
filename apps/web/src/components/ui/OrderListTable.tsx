import { Link } from 'react-router-dom';
import { formatCurrency } from '@/utils/format';
import { StatusBadge, LoadingState } from '@/components/ui';

/* eslint-disable @sync-erp/no-hardcoded-enum */
type OrderType = 'purchase' | 'sales';
/* eslint-enable @sync-erp/no-hardcoded-enum */

export interface OrderData {
  id: string;
  orderNumber: string | null;
  partnerId: string;
  partnerName?: string;
  totalAmount: number | string;
  status: string;
}

export interface OrderListTableProps<T extends OrderData> {
  /** Order type for labels and routes */
  type: OrderType;
  /** Array of orders to display */
  orders: T[];
  /** Loading state */
  loading?: boolean;
  /** Render function for action buttons */
  renderActions?: (order: T) => React.ReactNode;
  /** Optional additional columns */
  extraColumns?: {
    header: string;
    render: (order: T) => React.ReactNode;
    /* eslint-disable-next-line @sync-erp/no-hardcoded-enum */
    align?: 'left' | 'center' | 'right';
  }[];
}

/**
 * Generic order list table component for PO and SO lists.
 * Handles common table structure, leaving actions to the wrapper.
 */
export function OrderListTable<T extends OrderData>({
  type,
  orders,
  loading = false,
  renderActions,
  extraColumns = [],
}: OrderListTableProps<T>) {
  const isPurchase = type === 'purchase';
  const orderLabel = isPurchase ? 'PO' : 'SO';
  const partnerLabel = isPurchase ? 'Supplier' : 'Customer';
  const orderRoute = isPurchase ? 'purchase-orders' : 'sales-orders';
  const partnerRoute = isPurchase ? 'suppliers' : 'customers';
  const emptyMessage = isPurchase
    ? 'No purchase orders found.'
    : 'No sales orders found.';

  if (loading && orders.length === 0) {
    return <LoadingState />;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {orderLabel} Number
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {partnerLabel}
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Total
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            {extraColumns.map((col, idx) => (
              <th
                key={idx}
                className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                }`}
              >
                {col.header}
              </th>
            ))}
            {renderActions && (
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {orders.length === 0 ? (
            <tr>
              <td
                colSpan={
                  4 + extraColumns.length + (renderActions ? 1 : 0)
                }
                className="px-6 py-12 text-center text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-sm">
                  <Link
                    to={`/${orderRoute}/${order.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {order.orderNumber || '-'}
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <Link
                    to={`/${partnerRoute}/${order.partnerId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {order.partnerName || '-'}
                  </Link>
                </td>
                <td className="px-6 py-4 text-right">
                  {formatCurrency(Number(order.totalAmount))}
                </td>
                <td className="px-6 py-4 text-center">
                  <StatusBadge status={order.status} domain="order" />
                </td>
                {extraColumns.map((col, idx) => (
                  <td
                    key={idx}
                    className={`px-6 py-4 ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                    }`}
                  >
                    {col.render(order)}
                  </td>
                ))}
                {renderActions && (
                  <td className="px-6 py-4 text-right space-x-2">
                    {renderActions(order)}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
