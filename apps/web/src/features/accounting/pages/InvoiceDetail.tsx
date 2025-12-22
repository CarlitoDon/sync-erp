import { useParams, Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm } from '@/components/ui/ConfirmModal';
import ActionButton from '@/components/ui/ActionButton';
import { formatCurrency, formatDate } from '@/utils/format';
import { RecordPaymentModal } from '@/features/accounting/components/RecordPaymentModal';
import { PaymentHistoryModal } from '@/features/accounting/components/PaymentHistoryModal';
import { BackButton } from '@/components/ui/BackButton';
import { useState } from 'react';
import { getInvoiceStatusDisplay } from '@/features/accounting/utils/financeEnums';
import { InvoiceStatusSchema as StatusSchema } from '@/types/api';

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
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

  // Modal State
  const [showPayment, setShowPayment] = useState(false);
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
      <RecordPaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber || ''}
        balance={Number(invoice.balance)}
        dueDate={invoice.dueDate}
        documentType="invoice"
        onSuccess={() =>
          utils.invoice.getById.invalidate({ id: id! })
        }
      />

      {/* Payment History Modal */}
      <PaymentHistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        invoiceId={invoice.id}
        totalAmount={Number(invoice.amount)}
      />

      {/* Page Content */}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Invoice {invoice.invoiceNumber}
              </h1>
              <p className="text-sm text-gray-500">
                {invoice.partnerId ? (
                  <Link
                    to={`/customers/${invoice.partnerId}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {invoice.partner?.name || 'View Customer'}
                  </Link>
                ) : (
                  'Unknown Customer'
                )}
              </p>
            </div>
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
              <p className="text-sm text-gray-500">Sales Order</p>
              <p className="font-medium">
                {invoice.orderId ? (
                  <Link
                    to={`/sales-orders/${invoice.orderId}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-mono"
                  >
                    {invoice.order?.orderNumber || invoice.orderId}
                  </Link>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
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
                    onClick={() => setShowPayment(true)}
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
