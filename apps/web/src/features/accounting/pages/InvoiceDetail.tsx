import { useParams, useNavigate, Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm } from '@/components/ui/ConfirmModal';
import ActionButton from '@/components/ui/ActionButton';
import FormModal from '@/components/ui/FormModal';
import { formatCurrency, formatDate } from '@/utils/format';
import { PaymentHistoryList } from '@/features/accounting/components/PaymentHistoryList';
import Select from '@/components/ui/Select';
import { useState } from 'react';
import {
  PaymentMethod,
  paymentMethodOptions,
  defaultPaymentMethod,
  getInvoiceStatusDisplay,
} from '@/features/accounting/utils/financeEnums';
import { InvoiceStatusSchema as StatusSchema } from '@sync-erp/shared';

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const { data: invoice, isLoading: loading } =
    trpc.invoice.getById.useQuery(
      { id: id! },
      { enabled: !!id && !!currentCompany?.id }
    );

  const postMutation = trpc.invoice.post.useMutation({
    onSuccess: () => utils.invoice.getById.invalidate({ id: id! }),
  });

  const voidMutation = trpc.invoice.void.useMutation({
    onSuccess: () => utils.invoice.getById.invalidate({ id: id! }),
  });

  const paymentMutation = trpc.payment.create.useMutation({
    onSuccess: () => {
      utils.invoice.getById.invalidate({ id: id! });
      utils.payment.list.invalidate();
    },
  });

  // Payment Modal State
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    defaultPaymentMethod
  );
  const [showHistory, setShowHistory] = useState(false);

  const handlePost = async () => {
    if (!invoice) return;
    await apiAction(
      () => postMutation.mutateAsync({ id: invoice.id }),
      'Invoice posted!'
    );
  };

  const handleVoid = async () => {
    if (!invoice) return;
    const confirmed = await confirm({
      title: 'Void Invoice',
      message: 'Are you sure you want to void this invoice?',
      confirmText: 'Yes, Void',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () => voidMutation.mutateAsync({ id: invoice.id }),
      'Invoice voided'
    );
  };

  const handleRecordPayment = async () => {
    if (!invoice || paymentAmount <= 0 || paymentMutation.isPending)
      return;
    await apiAction(
      () =>
        paymentMutation.mutateAsync({
          invoiceId: invoice.id,
          amount: paymentAmount,
          method: paymentMethod,
          businessDate: new Date(),
        }),
      'Payment recorded!'
    );
    setShowPayment(false);
    setPaymentAmount(0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">
          Loading invoice details...
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Invoice not found</div>
      </div>
    );
  }

  const statusDisplay = getInvoiceStatusDisplay(invoice.status);

  return (
    <>
      {/* Payment Modal */}
      <FormModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        title="Record Payment"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">
                Invoice Number
              </span>
              <span className="font-mono font-medium">
                {invoice.invoiceNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">
                Customer ID
              </span>
              <span className="font-medium font-mono text-xs">
                {invoice.partnerId || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">
                Total Amount
              </span>
              <span className="font-medium">
                {formatCurrency(Number(invoice.amount))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">
                Outstanding Balance
              </span>
              <span className="font-bold text-red-600">
                {formatCurrency(Number(invoice.balance))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Due Date</span>
              <span
                className={
                  new Date(invoice.dueDate) < new Date()
                    ? 'text-red-600 font-bold'
                    : ''
                }
              >
                {formatDate(invoice.dueDate)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Amount *
            </label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) =>
                setPaymentAmount(Number(e.target.value))
              }
              max={Number(invoice.balance)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              Max: {formatCurrency(Number(invoice.balance))}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>
            <Select
              value={paymentMethod}
              onChange={(val) =>
                setPaymentMethod(val as PaymentMethod)
              }
              options={paymentMethodOptions}
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowPayment(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRecordPayment}
              disabled={
                paymentAmount <= 0 ||
                paymentAmount > Number(invoice.balance) ||
                paymentMutation.isPending
              }
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
            >
              {paymentMutation.isPending
                ? 'Processing...'
                : 'Confirm Payment'}
            </button>
          </div>
        </div>
      </FormModal>

      {/* Payment History Modal */}
      <FormModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        title="Payment History"
        maxWidth="2xl"
      >
        <PaymentHistoryList
          invoiceId={invoice.id}
          totalAmount={Number(invoice.amount)}
        />
      </FormModal>

      {/* Page Content */}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              Invoice {invoice.invoiceNumber}
            </h1>
            <p className="text-gray-500">
              {invoice.partnerId ? (
                <Link
                  to={`/customers/${invoice.partnerId}`}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Customer Details
                </Link>
              ) : (
                'Unknown Customer'
              )}
            </p>
          </div>
          <span
            className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusDisplay.color}`}
          >
            {statusDisplay.label}
          </span>
        </div>

        {/* Details Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">
            Invoice Details
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">Invoice Number</p>
              <p className="font-mono font-medium">
                {invoice.invoiceNumber}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Due Date</p>
              <p
                className={`font-medium ${
                  new Date(invoice.dueDate) < new Date() &&
                  invoice.status === 'POSTED'
                    ? 'text-red-600'
                    : ''
                }`}
              >
                {formatDate(invoice.dueDate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="font-medium">
                {formatDate(invoice.createdAt)}
              </p>
            </div>
          </div>

          <hr className="my-6" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">Total Amount</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(Number(invoice.amount))}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Balance Due</p>
              <p
                className={`text-xl font-bold ${
                  Number(invoice.balance) > 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}
              >
                {formatCurrency(Number(invoice.balance))}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Actions</h2>
          <div className="flex flex-wrap gap-3">
            {invoice.status === StatusSchema.enum.DRAFT && (
              <>
                <ActionButton variant="primary" onClick={handlePost}>
                  Post Invoice
                </ActionButton>
                <ActionButton variant="danger" onClick={handleVoid}>
                  Void
                </ActionButton>
              </>
            )}
            {invoice.status === StatusSchema.enum.POSTED &&
              Number(invoice.balance) > 0 && (
                <>
                  <ActionButton
                    variant="success"
                    onClick={() => {
                      setPaymentAmount(Number(invoice.balance));
                      setShowPayment(true);
                    }}
                  >
                    Record Payment
                  </ActionButton>
                  <ActionButton variant="danger" onClick={handleVoid}>
                    Void
                  </ActionButton>
                </>
              )}
            <ActionButton
              variant="secondary"
              onClick={() => setShowHistory(true)}
            >
              View Payment History
            </ActionButton>
          </div>
        </div>
      </div>
    </>
  );
}
