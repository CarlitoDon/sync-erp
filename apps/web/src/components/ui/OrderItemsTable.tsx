import { Link } from 'react-router-dom';
import { formatCurrency } from '@/utils/format';

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: unknown; // Accepts Decimal, number, string - converted via Number()
  product?: {
    name: string;
  } | null;
}

export interface OrderItemsTableProps {
  items: OrderItem[];
  productLinkPrefix?: string;
}

/**
 * Shared order items table for PO/SO detail pages.
 *
 * @example
 * <OrderItemsTable items={order.items} productLinkPrefix="/products" />
 */
export function OrderItemsTable({
  items,
  productLinkPrefix = '/products',
}: OrderItemsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Product
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Quantity
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Unit Price
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((item) => {
            const price = Number(item.price);
            const total = item.quantity * price;

            return (
              <tr key={item.id}>
                <td className="px-6 py-3">
                  {item.product ? (
                    <Link
                      to={`${productLinkPrefix}/${item.productId}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {item.product.name}
                    </Link>
                  ) : (
                    item.productId
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  {item.quantity}
                </td>
                <td className="px-6 py-3 text-right">
                  {formatCurrency(price)}
                </td>
                <td className="px-6 py-3 text-right font-medium">
                  {formatCurrency(total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
