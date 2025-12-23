import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { formatCurrency, formatDate } from '@/utils/format';
import { WalletIcon } from '@heroicons/react/24/outline';

export default function Payments() {
  const { currentCompany } = useCompany();
  // eslint-disable-next-line @sync-erp/no-hardcoded-enum -- UI filter, not database enum
  const [filter, setFilter] = useState<'all' | 'invoice' | 'bill'>(
    'all'
  );

  // Fetch payments - we'll need to check if this endpoint exists
  const { data: invoicePayments = [], isLoading: loadingInvoice } =
    trpc.payment.list.useQuery({}, { enabled: !!currentCompany?.id });

  const { data: billPayments = [], isLoading: loadingBill } =
    trpc.billPayment.list.useQuery(
      {},
      { enabled: !!currentCompany?.id }
    );

  const loading = loadingInvoice || loadingBill;

  // Combine and sort payments
  const allPayments = [
    ...invoicePayments.map((p) => ({
      ...p,
      type: 'RECEIVED' as const,
    })),
    ...billPayments.map((p) => ({ ...p, type: 'MADE' as const })),
  ].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
  );

  const filteredPayments =
    filter === 'all'
      ? allPayments
      : filter === 'invoice'
        ? allPayments.filter((p) => p.type === 'RECEIVED')
        : allPayments.filter((p) => p.type === 'MADE');

  const totalReceived = invoicePayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );
  const totalPaid = billPayments.reduce(
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
            Track all money received and paid
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-500 text-sm mb-1">
            Total Money Received
          </h3>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(totalReceived)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-500 text-sm mb-1">
            Total Money Paid
          </h3>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(totalPaid)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-500 text-sm mb-1">
            Net Cash Flow
          </h3>
          <p
            className={`text-2xl font-bold ${totalReceived - totalPaid >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {formatCurrency(totalReceived - totalPaid)}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === 'all'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All ({allPayments.length})
        </button>
        <button
          onClick={() => setFilter('invoice')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === 'invoice'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Received ({invoicePayments.length})
        </button>
        <button
          onClick={() => setFilter('bill')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === 'bill'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Paid ({billPayments.length})
        </button>
      </div>

      {/* Payments List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredPayments.length === 0 ? (
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
                  Type
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
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatDate(payment.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                        payment.type === 'RECEIVED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {payment.type === 'RECEIVED'
                        ? 'Money In'
                        : 'Money Out'}
                    </span>
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
                  <td
                    className={`px-6 py-4 text-sm text-right font-medium ${
                      payment.type === 'RECEIVED'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {payment.type === 'RECEIVED' ? '+' : '-'}
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
