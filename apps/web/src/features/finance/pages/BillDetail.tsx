import { useParams, useNavigate, Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm } from '@/components/ui/ConfirmModal';
import ActionButton from '@/components/ui/ActionButton';
import FormModal from '@/components/ui/FormModal';
import { formatCurrency, formatDate } from '@/utils/format';
import { PaymentHistoryList } from '@/features/finance/components/PaymentHistoryList';
import Select from '@/components/ui/Select';
import { useState } from 'react';
import {
  PaymentMethod,
  paymentMethodOptions,
  defaultPaymentMethod,
  getInvoiceStatusDisplay,
} from '@/features/finance/utils/financeEnums';
import { InvoiceStatusSchema as StatusSchema } from '@sync-erp/shared';

export default function BillDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const { data: bill, isLoading: loading } =
    trpc.bill.getById.useQuery(
      { id: id! },
      { enabled: !!id && !!currentCompany?.id }
    );

  const postMutation = trpc.bill.post.useMutation({
    onSuccess: () => utils.bill.getById.invalidate({ id: id! }),
  });

  const voidMutation = trpc.bill.void.useMutation({
    onSuccess: () => utils.bill.getById.invalidate({ id: id! }),
  });

  const paymentMutation = trpc.payment.create.useMutation({
    onSuccess: () => {
      utils.bill.getById.invalidate({ id: id! });
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
    if (!bill) return;
    await apiAction(
      () => postMutation.mutateAsync({ id: bill.id }),
      'Bill posted!'
    );
  };

  const handleVoid = async () => {
    if (!bill) return;
    const confirmed = await confirm({
      title: 'Void Bill',
      message: 'Are you sure you want to void this bill?',
      confirmText: 'Yes, Void',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () => voidMutation.mutateAsync({ id: bill.id }),
      'Bill voided'
    );
  };

  const handleRecordPayment = async () => {
    if (!bill || paymentAmount <= 0 || paymentMutation.isPending)
      return;
    await apiAction(
      () =>
        paymentMutation.mutateAsync({
          invoiceId: bill.id, // Bills use same payment endpoint
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
        <div className="text-gray-500">Loading bill details...</div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Bill not found</div>
      </div>
    );
  }

  const statusDisplay = getInvoiceStatusDisplay(bill.status);

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
                Bill Number
              </span>
              <span className="font-mono font-medium">
                {bill.invoiceNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">
                Supplier ID
              </span>
              <span className="font-medium font-mono text-xs">
                {bill.partnerId || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">
                Total Amount
              </span>
              <span className="font-medium">
                {formatCurrency(Number(bill.amount))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">
                Outstanding Balance
              </span>
              <span className="font-bold text-red-600">
                {formatCurrency(Number(bill.balance))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Due Date</span>
              <span
                className={
                  new Date(bill.dueDate) < new Date()
                    ? 'text-red-600 font-bold'
                    : ''
                }
              >
                {formatDate(bill.dueDate)}
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
              max={Number(bill.balance)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              Max: {formatCurrency(Number(bill.balance))}
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
                paymentAmount > Number(bill.balance) ||
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
          invoiceId={bill.id}
          totalAmount={Number(bill.amount)}
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
              Bill {bill.invoiceNumber}
            </h1>
            <p className="text-gray-500">
              {bill.partnerId ? (
                <Link
                  to={`/suppliers/${bill.partnerId}`}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Supplier Details
                </Link>
              ) : (
                'Unknown Supplier'
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
          <h2 className="text-lg font-semibold mb-4">Bill Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">Bill Number</p>
              <p className="font-mono font-medium">
                {bill.invoiceNumber}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Due Date</p>
              <p
                className={`font-medium ${
                  new Date(bill.dueDate) < new Date() &&
                  bill.status === 'POSTED'
                    ? 'text-red-600'
                    : ''
                }`}
              >
                {formatDate(bill.dueDate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="font-medium">
                {formatDate(bill.createdAt)}
              </p>
            </div>
          </div>

          <hr className="my-6" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">Total Amount</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(Number(bill.amount))}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Balance Due</p>
              <p
                className={`text-xl font-bold ${
                  Number(bill.balance) > 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}
              >
                {formatCurrency(Number(bill.balance))}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Actions</h2>
          <div className="flex flex-wrap gap-3">
            {bill.status === StatusSchema.enum.DRAFT && (
              <>
                <ActionButton variant="primary" onClick={handlePost}>
                  Post Bill
                </ActionButton>
                <ActionButton variant="danger" onClick={handleVoid}>
                  Void
                </ActionButton>
              </>
            )}
            {bill.status === StatusSchema.enum.POSTED &&
              Number(bill.balance) > 0 && (
                <>
                  <ActionButton
                    variant="success"
                    onClick={() => {
                      setPaymentAmount(Number(bill.balance));
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
