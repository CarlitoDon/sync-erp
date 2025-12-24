import { formatCurrency } from '@/utils/format';
import { PaymentStatusBadge } from '@/components/ui/PaymentStatusBadge';

interface UpfrontPaymentCardProps {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus:
    | 'PENDING'
    | 'PARTIAL'
    | 'PAID_UPFRONT'
    | 'SETTLED'
    | null;
  onRegisterPayment?: () => void;
  canRegisterPayment?: boolean;
}

export function UpfrontPaymentCard({
  totalAmount,
  paidAmount,
  remainingAmount,
  paymentStatus,
  onRegisterPayment,
  canRegisterPayment = true,
}: UpfrontPaymentCardProps) {
  const progressPercent =
    totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
  const isPaidFull =
    paymentStatus === 'PAID_UPFRONT' || paymentStatus === 'SETTLED';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Upfront Payment
        </h3>
        {paymentStatus && (
          <PaymentStatusBadge status={paymentStatus} />
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isPaidFull
                ? 'bg-green-500'
                : progressPercent > 0
                  ? 'bg-primary-500'
                  : 'bg-gray-300'
            }`}
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{Math.round(progressPercent)}% paid</span>
          <span>
            {formatCurrency(paidAmount)} /{' '}
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>

      {/* Amount Details */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Amount:</span>
          <span className="font-medium">
            {formatCurrency(totalAmount)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Paid Amount:</span>
          <span className="font-medium text-green-600">
            {formatCurrency(paidAmount)}
          </span>
        </div>
        {remainingAmount > 0 && (
          <div className="flex justify-between text-sm border-t pt-2">
            <span className="text-gray-600">Remaining:</span>
            <span className="font-bold text-orange-600">
              {formatCurrency(remainingAmount)}
            </span>
          </div>
        )}
      </div>

      {/* Record Payment Button */}
      {canRegisterPayment && remainingAmount > 0 && (
        <button
          onClick={onRegisterPayment}
          className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          Record Payment
        </button>
      )}

      {isPaidFull && (
        <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 rounded-lg py-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="font-medium">Fully Paid</span>
        </div>
      )}
    </div>
  );
}
