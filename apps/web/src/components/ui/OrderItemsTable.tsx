import { memo } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@/utils/format';

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  fulfilledQuantity?: number;
  price: unknown; // Accepts Decimal, number, string - converted via Number()
  product?: {
    name: string;
  } | null;
}

export interface OrderItemsTableProps {
  items: OrderItem[];
  productLinkPrefix?: string;
  showFulfilled?: boolean;
  fulfillmentLabel?: string;
}

/**
 * Memoized table row component for order items.
 * Prevents re-renders when parent table updates unrelated rows.
 */
const ItemRow = memo(function ItemRow({
  item,
  productLinkPrefix,
  showFulfilled,
}: {
  item: OrderItem;
  productLinkPrefix: string;
  showFulfilled: boolean;
}) {
  const price = Number(item.price);
  const total = item.quantity * price;

  return (
    <tr>
      <td className="px-6 py-3">
        {item.product ? (
          <Link
            to={`${productLinkPrefix}/${item.productId}`}
            className="text-cyan-700 hover:text-cyan-900 hover:underline"
          >
            {item.product.name}
          </Link>
        ) : (
          item.productId
        )}
      </td>
      <td className="px-6 py-3 text-right">{item.quantity}</td>
      {showFulfilled && (
        <td className="px-6 py-3 text-right">
          {item.fulfilledQuantity || 0}
        </td>
      )}
      <td className="px-6 py-3 text-right">
        {formatCurrency(price)}
      </td>
      <td className="px-6 py-3 text-right font-medium">
        {formatCurrency(total)}
      </td>
    </tr>
  );
});

/**
 * Shared order items table for PO/SO detail pages.
 *
 * @example
 * <OrderItemsTable items={order.items} productLinkPrefix="/products" />
 */
export function OrderItemsTable({
  items,
  productLinkPrefix = '/products',
  showFulfilled = false,
  fulfillmentLabel = 'Received',
}: OrderItemsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              Product
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
              Ordered
            </th>
            {showFulfilled && (
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                {fulfillmentLabel}
              </th>
            )}
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
              Unit Price
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              productLinkPrefix={productLinkPrefix}
              showFulfilled={showFulfilled}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
