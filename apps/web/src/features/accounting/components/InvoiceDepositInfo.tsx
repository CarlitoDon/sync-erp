import { trpc } from '@/lib/trpc';
import { formatCurrency, formatDate } from '@/utils/format';

interface InvoiceDepositInfoProps {
  invoiceId: string;
}

export function InvoiceDepositInfo({
  invoiceId,
}: InvoiceDepositInfoProps) {
  const { data: depositInfo, isLoading } =
    trpc.customerDeposit.getDepositInfo.useQuery(
      { invoiceId },
      { enabled: !!invoiceId }
    );

  if (isLoading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-blue-200 rounded w-1/3"></div>
      </div>
    );
  }

  if (!depositInfo?.hasDeposit) {
    return null;
  }

  const deposit = depositInfo.deposit;
  if (!deposit) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-blue-900">
          Customer Deposit Applied
        </h3>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
          Prepaid
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-blue-700">Deposit Amount</p>
          <p className="font-bold text-blue-900">
            {formatCurrency(deposit.amount)}
          </p>
        </div>
        <div>
          <p className="text-blue-700">Applied to Invoice</p>
          <p className="font-bold text-green-600">
            {formatCurrency(depositInfo.settlementAmount)}
          </p>
        </div>
        <div>
          <p className="text-blue-700">Remaining Balance</p>
          <p
            className={`font-bold ${depositInfo.remainingAfterSettlement > 0 ? 'text-orange-600' : 'text-green-600'}`}
          >
            {formatCurrency(depositInfo.remainingAfterSettlement)}
          </p>
        </div>
        <div>
          <p className="text-blue-700">Deposit Date</p>
          <p className="font-medium text-blue-900">
            {formatDate(deposit.paidAt)}
          </p>
        </div>
        {deposit.orderNumber && (
          <div>
            <p className="text-blue-700">From Order</p>
            <p className="font-medium text-blue-900">
              {deposit.orderNumber}
            </p>
          </div>
        )}
      </div>

      {depositInfo.remainingAfterSettlement === 0 && (
        <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-100 rounded-lg py-2 px-4">
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
          <span className="font-medium">
            Fully covered by deposit
          </span>
        </div>
      )}
    </div>
  );
}
