import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { formatCurrency, formatDate } from '@/utils/format';
import {
  WalletIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui';
import CreatePaymentModal from '../components/CreatePaymentModal';
import { InvoiceTypeSchema } from '@sync-erp/shared';

// eslint-disable-next-line @sync-erp/no-hardcoded-enum -- Local UI filter type, not database enum
type FilterType = 'all' | 'inbound' | 'outbound';

export default function Payments() {
  const { currentCompany } = useCompany();
  const [filter, setFilter] = useState<FilterType>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Fetch all payments with invoice and partner info
  const {
    data: payments = [],
    isLoading: loading,
    refetch,
  } = trpc.payment.list.useQuery(undefined, {
    enabled: !!currentCompany?.id,
  });

  // Determine direction from invoice type
  // BILL = outbound (money out to vendor), INVOICE = inbound (money in from customer)
  const getPaymentDirection = (payment: (typeof payments)[0]) => {
    if (!payment.invoice) return 'unknown';
    return payment.invoice.type === InvoiceTypeSchema.enum.BILL
      ? 'outbound'
      : 'inbound';
  };

  // Filter payments
  const filteredPayments =
    filter === 'all'
      ? payments
      : payments.filter((p) => getPaymentDirection(p) === filter);

  // Calculate stats
  const inboundPayments = payments.filter(
    (p) => getPaymentDirection(p) === 'inbound'
  );
  const outboundPayments = payments.filter(
    (p) => getPaymentDirection(p) === 'outbound'
  );

  const totalInbound = inboundPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );
  const totalOutbound = outboundPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );
  const netCashflow = totalInbound - totalOutbound;

  return (
    <PageContainer>
      <CreatePaymentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={refetch}
      />

      {/* Header */}
      <PageHeader
        title="Payments"
        description="Track all money received and paid"
        actions={
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="
              inline-flex items-center gap-2 px-4 py-2.5 
              bg-primary-600 text-white font-medium rounded-lg
              hover:bg-primary-700 transition-colors shadow-sm
            "
          >
            + New Payment
          </button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <ArrowDownTrayIcon className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">
                Total Money In
              </span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalInbound)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {inboundPayments.length} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <ArrowUpTrayIcon className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">
                Total Money Out
              </span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              ({formatCurrency(totalOutbound)})
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {outboundPayments.length} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <ArrowsRightLeftIcon className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">
                Net Cashflow
              </span>
            </div>
            <p
              className={`text-2xl font-bold ${netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {netCashflow >= 0 ? '+' : ''}
              {formatCurrency(netCashflow)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {payments.length} total transactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            filter === 'all'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          All ({payments.length})
        </button>
        <button
          onClick={() => setFilter('inbound')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            filter === 'inbound'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🟢 Inbound ({inboundPayments.length})
        </button>
        <button
          onClick={() => setFilter('outbound')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            filter === 'outbound'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🔴 Outbound ({outboundPayments.length})
        </button>
      </div>

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <LoadingState size="md" />
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Partner
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Memo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPayments.map((payment) => {
                    const direction = getPaymentDirection(payment);
                    const isInbound = direction === 'inbound';

                    return (
                      <tr
                        key={payment.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatDate(payment.date)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <Link
                            to={`/payments/${payment.id}`}
                            className="text-blue-600 hover:underline font-mono"
                          >
                            {payment.id.slice(0, 8).toUpperCase()}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${
                              isInbound
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {isInbound ? (
                              <>
                                <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                                Receive
                              </>
                            ) : (
                              <>
                                <ArrowUpTrayIcon className="w-3.5 h-3.5" />
                                Send
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {payment.invoice?.partner?.name || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {payment.method}
                        </td>
                        <td
                          className={`px-6 py-4 text-sm text-right font-bold ${
                            isInbound
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {isInbound ? '+' : '-'}
                          {formatCurrency(Number(payment.amount))}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate">
                          {payment.reference || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
