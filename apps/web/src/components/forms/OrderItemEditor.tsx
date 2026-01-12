import Select from '@/components/ui/Select';
import { QuantityInput, CurrencyInput } from '@/components/ui';
import ActionButton from '@/components/ui/ActionButton';
import { formatCurrency } from '@/utils/format';
import type {
  OrderItemForm,
  OrderTotals,
} from '@/hooks/useOrderForm';

// Type for Prisma Decimal that can be number, string, or Decimal object
type DecimalLike = number | string | { toNumber(): number } | null;

interface Product {
  id: string;
  sku: string;
  name: string;
  price: DecimalLike;
}

export interface OrderItemEditorProps {
  /** Available products to select from */
  products: Product[];
  /** Current item being edited (before adding) */
  currentItem: OrderItemForm;
  /** Handler for updating current item */
  onCurrentItemChange: (item: OrderItemForm) => void;
  /** Handler for adding current item to list */
  onAddItem: () => void;
  /** Handler for removing item at index */
  onRemoveItem: (index: number) => void;
  /** Handler for updating existing item (optional, enables inline editing) */
  onUpdateItem?: (index: number, item: OrderItemForm) => void;
  /** List of items already added */
  items: OrderItemForm[];
  /** Calculated totals for display */
  totals: OrderTotals;
}

/**
 * Shared component for editing order line items.
 * Used by both Purchase Orders and Sales Orders.
 *
 * Features:
 * - Product selection with auto-fill price
 * - Quantity and price inputs
 * - Items table with remove action
 * - Totals summary (subtotal, tax, grand total)
 */
export default function OrderItemEditor({
  products,
  currentItem,
  onCurrentItemChange,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  items,
  totals,
}: OrderItemEditorProps) {
  const getProductName = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product?.name || productId;
  };

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    onCurrentItemChange({
      ...currentItem,
      productId,
      price: product?.price ? Number(product.price) : 0,
    });
  };

  // Check if any item has zero price
  const hasZeroPriceItems = items.some((item) => item.price <= 0);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h3 className="font-medium">Add Items</h3>

      {/* Add Item Row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-1">
          <Select
            value={currentItem.productId}
            onChange={handleProductChange}
            options={products.map((p) => ({
              value: p.id,
              label: `${p.sku} - ${p.name}`,
            }))}
            placeholder="Select product"
          />
        </div>
        <div>
          <QuantityInput
            placeholder="Qty"
            value={currentItem.quantity}
            onChange={(qty) =>
              onCurrentItemChange({
                ...currentItem,
                quantity: qty,
              })
            }
          />
        </div>
        <div>
          <CurrencyInput
            placeholder="0"
            value={currentItem.price}
            onChange={(price) =>
              onCurrentItemChange({
                ...currentItem,
                price: price,
              })
            }
          />
        </div>
        <button
          type="button"
          onClick={onAddItem}
          className="px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-100"
        >
          Add
        </button>
      </div>

      {/* Items Table */}
      {items.length > 0 && (
        <>
          {hasZeroPriceItems && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              ⚠️ Ada item dengan harga Rp 0. Silakan isi harga terlebih dahulu.
            </div>
          )}
          <table className="w-full mt-4">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm">Product</th>
                <th className="px-4 py-2 text-right text-sm">Qty</th>
                <th className="px-4 py-2 text-right text-sm">
                  Unit Price
                </th>
                <th className="px-4 py-2 text-right text-sm">Total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className={`border-t ${item.price <= 0 ? 'bg-amber-50' : ''}`}>
                  <td className="px-4 py-2">
                    {getProductName(item.productId)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-2">
                    {onUpdateItem ? (
                      <div className="flex justify-end">
                        <CurrencyInput
                          value={item.price}
                          onChange={(price) =>
                            onUpdateItem(index, { ...item, price })
                          }
                          className={`w-32 text-right ${item.price <= 0 ? 'border-amber-400 bg-amber-50' : ''}`}
                        />
                      </div>
                    ) : (
                      <span className="block text-right">{formatCurrency(item.price)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatCurrency(item.quantity * item.price)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ActionButton
                      onClick={() => onRemoveItem(index)}
                      variant="danger"
                    >
                      Remove
                    </ActionButton>
                  </td>
                </tr>
              ))}

            {/* Totals Summary */}
            <tr className="border-t">
              <td
                colSpan={3}
                className="px-4 py-2 text-right text-gray-600"
              >
                Subtotal:
              </td>
              <td className="px-4 py-2 text-right">
                {formatCurrency(totals.subtotal)}
              </td>
              <td></td>
            </tr>
            {totals.taxRate > 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-2 text-right text-gray-600"
                >
                  PPN ({totals.taxRate}%):
                </td>
                <td className="px-4 py-2 text-right">
                  {formatCurrency(totals.taxAmount)}
                </td>
                <td></td>
              </tr>
            )}
            <tr
              className={
                totals.taxRate > 0
                  ? 'border-t-2 font-semibold'
                  : 'font-semibold'
              }
            >
              <td colSpan={3} className="px-4 py-2 text-right">
                Total:
              </td>
              <td className="px-4 py-2 text-right">
                {formatCurrency(totals.grandTotal)}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
        </>
      )}
    </div>
  );
}
