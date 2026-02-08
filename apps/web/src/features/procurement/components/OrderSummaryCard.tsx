import { Link } from 'react-router-dom';
import { formatDate } from '@/utils/format';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FulfillmentStatusBadge,
} from '@/components/ui';

interface OrderSummaryCardProps {
  orderNumber: string;
  createdAt: Date | string;
  supplierId?: string | null;
  supplierName?: string | null;
  taxRate?: number | null;
  status: string;
}

/**
 * Compact card showing order metadata: number, date, supplier, tax rate.
 */
export function OrderSummaryCard({
  orderNumber,
  createdAt,
  supplierId,
  supplierName,
  taxRate,
  status,
}: OrderSummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Order Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Order Number
            </p>
            <p className="font-mono font-medium text-sm">
              {orderNumber}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Created
            </p>
            <p className="font-medium text-sm">
              {formatDate(createdAt)}
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Supplier
          </p>
          {supplierId && supplierName ? (
            <Link
              to={`/suppliers/${supplierId}`}
              className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium"
            >
              {supplierName}
            </Link>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Tax Rate
            </p>
            <p className="font-medium text-sm">
              {taxRate ? `${Number(taxRate)}%` : 'No Tax'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Receipt Status
            </p>
            <FulfillmentStatusBadge status={status} type="receipt" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
