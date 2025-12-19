import { useEffect, useState } from 'react';
import { Payment } from '@sync-erp/shared';
import { paymentService } from '@/features/finance/services/paymentService';
import { apiAction } from '@/utils/apiAction';
import { formatDate } from '@/utils/format';

interface PaymentHistoryListProps {
  invoiceId: string;
  totalAmount: number;
  currency?: string;
}

export function PaymentHistoryList({
  invoiceId,
  totalAmount,
  currency = 'IDR',
}: PaymentHistoryListProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPayments = async () => {
      setLoading(true);
      await apiAction(
        () => paymentService.getPaymentHistory(invoiceId),
        {
          onSuccess: (data) => setPayments(data),
          onError: () => setPayments([]), // Handle API error gracefully
          errorMessage: 'Failed to load payment history',
        }
      );
      setLoading(false);
    };

    if (invoiceId) {
      loadPayments();
    }
  }, [invoiceId]);

  const totalPaid = payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );
  const remainingBalance = totalAmount - totalPaid;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="text-sm text-gray-500 animate-pulse">
        Loading payment history...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Reference
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Method
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {payments.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-4 text-center text-sm text-gray-500"
                >
                  No payments recorded.
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatDate(payment.date)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    -
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {payment.method}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(Number(payment.amount))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td
                colSpan={3}
                className="px-6 py-4 text-right text-sm font-medium text-gray-500"
              >
                Total Paid:
              </td>
              <td className="px-6 py-4 text-right text-sm font-bold text-success-600">
                {formatCurrency(totalPaid)}
              </td>
            </tr>
            <tr>
              <td
                colSpan={3}
                className="px-6 py-4 text-right text-sm font-medium text-gray-500"
              >
                Remaining Balance:
              </td>
              <td
                className={`px-6 py-4 text-right text-sm font-bold ${remainingBalance > 0 ? 'text-red-600' : 'text-gray-900'}`}
              >
                {formatCurrency(remainingBalance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
