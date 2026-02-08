import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui';
import { formatCurrency } from '@/utils/format';
import { RentalOrderCalculations } from '../hooks/useRentalOrderCalculations';

interface RentalOrderItem {
  id: string;
  quantity: number;
  unitPrice: number | string;
  subtotal: number | string;
  rentalBundleId?: string | null;
  rentalBundle?: {
    name: string;
    components?: {
      rentalItem?: {
        product?: {
          name: string;
        };
      };
    }[];
  } | null;
  rentalItem?: {
    product?: {
      name: string;
    };
  } | null;
}

interface RentalItemsTableProps {
  items: RentalOrderItem[];
  calculations: RentalOrderCalculations;
}

export function RentalItemsTable({
  items,
  calculations,
}: RentalItemsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rental Items</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Product
                </th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">
                  Qty
                </th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">
                  Day(s)
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Price
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.rentalBundle?.name ||
                          item.rentalItem?.product?.name ||
                          'Unknown Product'}
                      </p>
                      {item.rentalBundle && (
                        <p className="text-sm text-gray-500">
                          {item.rentalBundle.components
                            ?.map((c) => c.rentalItem?.product?.name)
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {calculations.durationDays}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(Number(item.unitPrice))}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(Number(item.subtotal))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-medium">
              <tr>
                <td className="px-4 py-3" colSpan={4}>
                  Subtotal
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(calculations.subtotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
