import { Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { formatCurrency, formatDate } from '@/utils/format';
import { WalletIcon } from '@heroicons/react/24/outline';

export default function Payments() {
  const { currentCompany } = useCompany();

  // Fetch all payments
  const { data: payments = [], isLoading: loading } =
    trpc.payment.list.useQuery(undefined, {
      enabled: !!currentCompany?.id,
    });

  const totalAmount = payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Payments
          </h1>
          <p className="text-gray-500">
            Track all payment transactions
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-500 text-sm mb-1">
            Total Payments
          </h3>
          <p className="text-2xl font-bold text-gray-900">
            {payments.length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-500 text-sm mb-1">
            Total Amount
          </h3>
          <p className="text-2xl font-bold text-primary-600">
            {formatCurrency(totalAmount)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-500 text-sm mb-1">
            This Month
          </h3>
          <p className="text-2xl font-bold text-gray-400">-</p>
        </div>
      </div>

      {/* Payments List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <WalletIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No payments found
            </h3>
            <p className="text-gray-500">
              Payments will appear here when invoices or bills are
              paid.
            </p>
          </div>
        ) : (
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
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatDate(payment.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Link
                      to={`/payments/${payment.id}`}
                      className="text-blue-600 hover:underline font-mono"
                    >
                      {payment.reference || payment.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {payment.method}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                    {formatCurrency(Number(payment.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
