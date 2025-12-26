import { useParams, Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { formatCurrency, formatDate } from '@/utils/format';
import { RecordPaymentModal } from '@/features/accounting/components/RecordPaymentModal';
import { PaymentHistoryModal } from '@/features/accounting/components/PaymentHistoryModal';
import { useState } from 'react';
import { getBillStatusDisplay } from '@/features/accounting/utils/financeEnums';
import { InvoiceStatusSchema as StatusSchema } from '@/types/api';
import { getPaymentTermLabel } from '@sync-erp/shared';
import { PageContainer } from '@/components/layout/PageLayout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  PageHeader,
  ActionButton,
  useConfirm,
  LoadingState,
  EmptyState,
} from '@/components/ui';

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

    // FR-024: Prompt for void reason
    const reason = window.prompt(
      'Please enter a reason for voiding this bill:'
    );
    if (!reason || reason.trim().length === 0) {
      return; // User cancelled
    }

    const confirmed = await confirm({
      title: 'Void Bill',
      message: 'Are you sure you want to void this bill?',
      confirmText: 'Yes, Void',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () => voidMutation.mutateAsync({ id: bill.id, reason }),
      'Bill voided'
    );
  };

  if (loading) {
    return <LoadingState />;
  }

  if (!bill) {
    return <EmptyState message="Bill not found" />;
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
      <PageContainer>
        {/* Header */}
        <PageHeader
          title={`Bill ${bill.invoiceNumber}`}
          subtitle={
            bill.partnerId ? (
              <Link
                to={`/suppliers/${bill.partnerId}`}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {bill.partner?.name || 'View Supplier'}
              </Link>
            ) : (
              'Unknown Supplier'
            )
          }
          badges={
            <span
              className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusDisplay.color}`}
            >
              {statusDisplay.label}
            </span>
          }
        />

        {/* Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Bill Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-500">Bill Number</p>
                <p className="font-mono font-medium">
                  {bill.invoiceNumber}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">
                  Purchase Order
                </p>
                <p className="font-medium">
                  {bill.orderId ? (
                    <Link
                      to={`/purchase-orders/${bill.orderId}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-mono"
                    >
                      {bill.order?.orderNumber || bill.orderId}
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
                    new Date(bill.dueDate) < new Date() &&
                    bill.status === StatusSchema.enum.POSTED
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
                  <p className="text-sm text-gray-500">
                    Payment Terms
                  </p>
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
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {bill.status === StatusSchema.enum.DRAFT && (
                <>
                  <ActionButton
                    variant="primary"
                    onClick={handlePost}
                  >
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
                    <ActionButton
                      variant="danger"
                      onClick={handleVoid}
                    >
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
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
