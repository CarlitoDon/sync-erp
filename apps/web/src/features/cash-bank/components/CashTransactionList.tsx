import { formatCurrency, formatDate } from '@/utils/format';
import { LoadingState } from '@/components/ui';
import { useCashTransactions } from '../hooks';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import {
  CashTransactionStatusSchema,
  CashTransactionTypeSchema,
} from '@sync-erp/shared';

// Browser-safe enum constants derived from Zod schemas
const CashTransactionType = CashTransactionTypeSchema.enum;
const CashTransactionStatus = CashTransactionStatusSchema.enum;

const TYPE_ICONS: Record<string, React.ReactNode> = {
  [CashTransactionType.SPEND]: (
    <ArrowUpIcon className="w-4 h-4 text-red-500" />
  ),
  [CashTransactionType.RECEIVE]: (
    <ArrowDownIcon className="w-4 h-4 text-green-500" />
  ),
  [CashTransactionType.TRANSFER]: (
    <ArrowsRightLeftIcon className="w-4 h-4 text-blue-500" />
  ),
};

const STATUS_STLYES: Record<string, string> = {
  [CashTransactionStatus.DRAFT]: 'bg-gray-100 text-gray-700',
  [CashTransactionStatus.POSTED]: 'bg-green-100 text-green-700',
  [CashTransactionStatus.VOIDED]: 'bg-red-100 text-red-700',
};

export default function CashTransactionList() {
  const { transactions, loading, postTransaction, isPosting } =
    useCashTransactions();

  if (loading && transactions.length === 0) {
    return <LoadingState size="md" />;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                Account(s)
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {transactions.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No transactions recorded yet.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatDate(tx.date)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {TYPE_ICONS[tx.type as keyof typeof TYPE_ICONS]}
                      {tx.type}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 font-medium">
                      {tx.reference || '-'}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">
                      {tx.payee || tx.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex flex-col gap-0.5">
                      {tx.sourceBank && (
                        <span className="flex items-center gap-1">
                          <span className="text-[10px] bg-red-50 text-red-600 px-1 rounded">
                            FROM
                          </span>
                          {tx.sourceBank.bankName}
                        </span>
                      )}
                      {tx.destinationBank && (
                        <span className="flex items-center gap-1">
                          <span className="text-[10px] bg-green-50 text-green-600 px-1 rounded">
                            TO
                          </span>
                          {tx.destinationBank.bankName}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div
                      className={`text-sm font-bold ${tx.type === 'SPEND' ? 'text-red-600' : tx.type === 'RECEIVE' ? 'text-green-600' : 'text-gray-900'}`}
                    >
                      {tx.type === 'SPEND' ? '-' : ''}
                      {formatCurrency(Number(tx.amount))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${STATUS_STLYES[tx.status as keyof typeof STATUS_STLYES]}`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {tx.status === CashTransactionStatus.DRAFT && (
                      <button
                        onClick={() => postTransaction(tx.id)}
                        disabled={isPosting}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        POST
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
