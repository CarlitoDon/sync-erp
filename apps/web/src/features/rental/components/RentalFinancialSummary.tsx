import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui';
import { formatCurrency } from '@/utils/format';
import { RentalOrderCalculations } from '../hooks/useRentalOrderCalculations';

interface RentalFinancialSummaryProps {
  calculations: RentalOrderCalculations;
}

export function RentalFinancialSummary({
  calculations,
}: RentalFinancialSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* Subtotal */}
        <div className="flex justify-between">
          <span className="text-gray-500">Subtotal</span>
          <span className="font-medium">
            {formatCurrency(calculations.subtotal)}
          </span>
        </div>

        {/* Discount (if any) */}
        {calculations.hasDiscount && (
          <div className="flex justify-between text-green-600">
            <span>
              Diskon{' '}
              {calculations.discountLabel
                ? `(${calculations.discountLabel})`
                : ''}
            </span>
            <span className="font-medium">
              -{formatCurrency(calculations.discountAmount)}
            </span>
          </div>
        )}

        {/* Delivery Fee (if any) */}
        {calculations.hasDeliveryFee && (
          <div className="flex justify-between">
            <span className="text-gray-500">Ongkir</span>
            <span className="font-medium">
              {formatCurrency(calculations.deliveryFee)}
            </span>
          </div>
        )}

        <hr className="my-2" />

        {/* Total */}
        <div className="flex justify-between">
          <span className="text-gray-500">Total Amount</span>
          <span className="font-semibold">
            {formatCurrency(calculations.totalAmount)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Deposit Amount</span>
          <span className="font-medium">
            {formatCurrency(calculations.depositAmount)}
          </span>
        </div>
        <hr className="my-2" />
        <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
          <span className="font-semibold text-gray-700">
            Net Outstanding
          </span>
          <span className="font-bold text-gray-900">
            {formatCurrency(calculations.netOutstanding)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
