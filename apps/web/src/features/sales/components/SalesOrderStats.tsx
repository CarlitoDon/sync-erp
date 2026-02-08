import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { formatCurrency } from '@/utils/format';
import { SalesOrderCalculations } from '../hooks/useSalesOrderCalculations';

interface SalesOrderStatsProps {
  calculations: SalesOrderCalculations;
}

export function SalesOrderStats({
  calculations,
}: SalesOrderStatsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500 mb-2">Total Amount</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(calculations.totalAmount)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">
              Total Invoiced
            </p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(calculations.totalInvoiced)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Outstanding</p>
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(calculations.outstandingAmount)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
