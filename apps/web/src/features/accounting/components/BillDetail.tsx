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
import { getBillStatusDisplay } from '@/features/accounting/utils/financeEnums';
import {
  InvoiceStatusSchema as StatusSchema,
  getPaymentTermLabel,
} from '@sync-erp/shared';

export default function BillDetail() {
  const { id } = useParams<{ id: string }>();
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

  // Modal State
  const [showPayment, setShowPayment] = useState(false);
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

  const statusDisplay = getBillStatusDisplay(bill.status);

  return (
    <>
      {/* Payment Modal */}
      <RecordPaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        invoiceId={bill.id}
        invoiceNumber={bill.invoiceNumber || ''}
        balance={Number(bill.balance)}
        dueDate={bill.dueDate}
        documentType="bill"
        onSuccess={() => utils.bill.getById.invalidate({ id: id! })}
      />

      {/* Payment History Modal */}
      <PaymentHistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        invoiceId={bill.id}
        totalAmount={Number(bill.amount)}
      />

      {/* Page Content */}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <BackButton to="/bills" />
            <h1 className="text-2xl font-bold text-gray-900 mt-2">
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
            {bill.paymentTermsString && (
              <div>
                <p className="text-sm text-gray-500">Payment Terms</p>
                <p className="font-medium">
                  {getPaymentTermLabel(bill.paymentTermsString)}
                </p>
              </div>
            )}
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
