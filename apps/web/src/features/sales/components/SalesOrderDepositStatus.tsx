import { ActionButton } from '@/components/ui';
import { formatCurrency } from '@/utils/format';
import { PaymentTermsSchema } from '@sync-erp/shared';
import { SalesOrderCalculations } from '../hooks/useSalesOrderCalculations';
import { useNavigate } from 'react-router-dom';
import { RouterOutputs } from '@/lib/trpc';

type SalesOrder = NonNullable<RouterOutputs['salesOrder']['getById']>;

interface SalesOrderDepositStatusProps {
  order: SalesOrder;
  calculations: SalesOrderCalculations;
}

export function SalesOrderDepositStatus({
  order,
  calculations,
}: SalesOrderDepositStatusProps) {
  const navigate = useNavigate();
  const isUpfrontOrder =
    order.paymentTerms === PaymentTermsSchema.enum.UPFRONT;
  const hasDpRequired = isUpfrontOrder || calculations.dpAmount > 0;

  if (!hasDpRequired) return null;

  const { isDpPaid, dpAmount, dpPercent, dpInvoice } = calculations;

  return (
    <div
      className={`border-l-4 p-4 rounded-lg ${
        isDpPaid
          ? 'bg-green-50 border-green-500'
          : 'bg-blue-50 border-blue-500'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p
            className={`font-semibold ${
              isDpPaid ? 'text-green-800' : 'text-blue-800'
            }`}
          >
            {isDpPaid
              ? '✅ Customer Deposit Received'
              : '💰 Customer Deposit Required'}
          </p>
          <p
            className={`text-sm ${
              isDpPaid ? 'text-green-700' : 'text-blue-700'
            }`}
          >
            {isUpfrontOrder
              ? `Full upfront payment: ${formatCurrency(calculations.totalAmount)}`
              : `DP ${dpPercent}%: ${formatCurrency(dpAmount)}`}
          </p>
          {!isDpPaid && !isUpfrontOrder && (
            <p className="text-xs text-blue-600 mt-1">
              Remaining after deposit:{' '}
              {formatCurrency(calculations.outstandingAmount)}
            </p>
          )}
        </div>
        {dpInvoice ? (
          <ActionButton
            variant={isDpPaid ? 'secondary' : 'primary'}
            onClick={() => navigate(`/invoices/${dpInvoice.id}`)}
          >
            {isDpPaid ? 'View DP Invoice' : '💳 Collect DP →'}
          </ActionButton>
        ) : (
          <span className="text-sm text-gray-500">
            Confirm SO to create Deposit Invoice
          </span>
        )}
      </div>
    </div>
  );
}
