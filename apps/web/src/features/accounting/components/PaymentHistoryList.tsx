import { Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { formatDate } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { usePrompt } from '@/components/ui/PromptModal';

interface PaymentHistoryListProps {
  invoiceId: string;
  totalAmount: number | string;
  currency?: string;
}

export function PaymentHistoryList({
  invoiceId,
  totalAmount,
  currency = 'IDR',
}: PaymentHistoryListProps) {
  const confirm = useConfirm();
  const prompt = usePrompt();
  const utils = trpc.useUtils();

  // Filter payments client-side since we don't have getByInvoiceId endpoint
  const { data: allPayments = [], isLoading: loading } =
    trpc.payment.list.useQuery();

  const voidMutation = trpc.payment.void.useMutation({
    onSuccess: () => {
      utils.payment.list.invalidate();
      utils.invoice.getById.invalidate();
      utils.bill.getById.invalidate();
    },
  });

  // Filter to this invoice (exclude voided)
  const payments = allPayments.filter(
    (p) =>
      p.invoiceId === invoiceId && !p.reference?.includes('[VOIDED]')
  );

  const totalPaid = payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );
  const remainingBalance = Number(totalAmount) - totalPaid;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleVoidPayment = async (paymentId: string) => {
    // FR-024: Prompt for void reason (accessible modal)
    const reason = await prompt({
      title: 'Void Payment',
      message: 'Please enter a reason for voiding this payment:',
      placeholder: 'Enter reason...',
      required: true,
    });
    if (!reason) {
      return; // User cancelled
    }

    const confirmed = await confirm({
      title: 'Void Payment',
      message:
        'This will restore the invoice balance. Are you sure you want to void this payment?',
      confirmText: 'Yes, Void',
      variant: 'danger',
    });

    if (confirmed) {
      try {
        await voidMutation.mutateAsync({ id: paymentId, reason });
      } catch (error) {
        console.error('Failed to void payment:', error);
      }
    }
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
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {payments.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
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
                  <td className="px-6 py-4 text-sm">
                    <Link
                      to={`/payments/${payment.id}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-mono"
                    >
                      {payment.reference ||
                        `PAY-${payment.id.slice(0, 8)}`}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {payment.method}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(Number(payment.amount))}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleVoidPayment(payment.id)}
                      disabled={voidMutation.isPending}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                    >
                      Void
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td
                colSpan={4}
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
                colSpan={4}
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
