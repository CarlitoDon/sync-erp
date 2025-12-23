import { formatCurrency, formatDate } from '@/utils/format';

interface Payment {
  id: string;
  amount: number | { toNumber?: () => number };
  method: string;
  reference?: string | null;
  createdAt: Date | string;
  settledAt?: Date | string | null;
}

interface PaymentHistoryTableProps {
  payments: Payment[];
  isLoading?: boolean;
}

const methodLabels: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  CASH: 'Cash',
  CHECK: 'Check',
  CREDIT_CARD: 'Credit Card',
  OTHER: 'Other',
};

export function PaymentHistoryTable({
  payments,
  isLoading = false,
}: PaymentHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Payment History
        </h3>
        <p className="text-gray-500 text-center py-4">
          No payments recorded yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Payment History
      </h3>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Method
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Reference
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Amount
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {payments.map((payment) => {
            const amount =
              typeof payment.amount === 'object' &&
              payment.amount?.toNumber
                ? payment.amount.toNumber()
                : Number(payment.amount);

            return (
              <tr key={payment.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">
                  {formatDate(payment.createdAt)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {methodLabels[payment.method] || payment.method}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {payment.reference || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                  {formatCurrency(amount)}
                </td>
                <td className="px-4 py-3 text-center">
                  {payment.settledAt ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Settled
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Active
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
