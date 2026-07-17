import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { formatCurrency, formatDateTime } from '@/utils/format';

type DecimalLike = number | string | { toString(): string } | null | undefined;

interface RentalOrderItemForExtension {
  id: string;
  rentalBundle?: {
    name: string;
  } | null;
  rentalItem?: {
    product?: {
      name: string;
    } | null;
  } | null;
}

interface RentalOrderExtensionItemForView {
  id: string;
  rentalOrderItemId: string | null;
  quantity: number;
  previousEndDate: Date | string;
  newEndDate: Date | string;
  additionalDays: number;
  unitPrice: DecimalLike;
  additionalAmount: DecimalLike;
  notes?: string | null;
}

export interface RentalOrderExtensionForView {
  id: string;
  extensionNumber: number;
  previousEndDate: Date | string;
  newEndDate: Date | string;
  additionalDays: number;
  additionalAmount: DecimalLike;
  deliveryFee?: DecimalLike;
  deliveryFeeLabel?: string | null;
  reason?: string | null;
  isPaid: boolean;
  paidAt?: Date | string | null;
  items?: RentalOrderExtensionItemForView[];
}

interface RentalExtensionsCardProps {
  extensions?: RentalOrderExtensionForView[];
  orderItems: RentalOrderItemForExtension[];
}

function toNumber(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;
  return Number(value.toString());
}

function getOrderItemName(
  orderItems: RentalOrderItemForExtension[],
  orderItemId: string | null
): string {
  if (!orderItemId) return 'Unknown item';
  const orderItem = orderItems.find((item) => item.id === orderItemId);
  return (
    orderItem?.rentalBundle?.name ||
    orderItem?.rentalItem?.product?.name ||
    'Unknown item'
  );
}

export function RentalExtensionsCard({
  extensions = [],
  orderItems,
}: RentalExtensionsCardProps) {
  if (!extensions.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Extensions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {extensions.map((extension) => {
          const deliveryFee = toNumber(extension.deliveryFee);
          const totalAmount = toNumber(extension.additionalAmount);
          const itemAmount = Math.max(totalAmount - deliveryFee, 0);

          return (
            <div
              key={extension.id}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <div className="bg-gray-50 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">
                      Extension #{extension.extensionNumber}
                    </p>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        extension.isPaid
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {extension.isPaid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatDateTime(extension.previousEndDate)} →{' '}
                    {formatDateTime(extension.newEndDate)}
                  </p>
                </div>
                <div className="text-left sm:text-right text-sm">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(totalAmount)}
                  </p>
                  {extension.paidAt && (
                    <p className="text-xs text-gray-500">
                      Paid {formatDateTime(extension.paidAt)}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-3">
                {extension.reason && (
                  <p className="text-sm text-gray-600">
                    {extension.reason}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-md border border-gray-200 p-3">
                    <p className="text-xs uppercase text-gray-400">
                      Item charge
                    </p>
                    <p className="font-medium text-gray-900">
                      {formatCurrency(itemAmount)}
                    </p>
                  </div>
                  <div className="rounded-md border border-gray-200 p-3">
                    <p className="text-xs uppercase text-gray-400">
                      Extension delivery fee
                    </p>
                    <p className="font-medium text-gray-900">
                      {formatCurrency(deliveryFee)}
                    </p>
                    {extension.deliveryFeeLabel && (
                      <p className="text-xs text-gray-500">
                        {extension.deliveryFeeLabel}
                      </p>
                    )}
                  </div>
                  <div className="rounded-md border border-gray-200 p-3">
                    <p className="text-xs uppercase text-gray-400">
                      Additional days
                    </p>
                    <p className="font-medium text-gray-900">
                      {extension.additionalDays} hari
                    </p>
                  </div>
                </div>

                {!!extension.items?.length && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">
                            Item
                          </th>
                          <th className="px-3 py-2 text-center font-medium">
                            Qty
                          </th>
                          <th className="px-3 py-2 text-center font-medium">
                            Period
                          </th>
                          <th className="px-3 py-2 text-right font-medium">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {extension.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-900">
                                {getOrderItemName(
                                  orderItems,
                                  item.rentalOrderItemId
                                )}
                              </p>
                              {item.notes && (
                                <p className="text-xs text-gray-500">
                                  {item.notes}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-600">
                              {formatDateTime(item.previousEndDate)} →{' '}
                              {formatDateTime(item.newEndDate)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatCurrency(toNumber(item.additionalAmount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
