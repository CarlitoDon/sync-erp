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
import { PriceVarianceCard } from './PriceVarianceCard';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  PageHeader,
  ActionButton,
  useConfirm,
  usePrompt,
  LoadingState,
  EmptyState,
} from '@/components/ui';

export default function BillDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const utils = trpc.useUtils();

  const { data: bill, isLoading: loading } =
    trpc.bill.getById.useQuery(
      { id: id! },
      { enabled: !!id && !!currentCompany?.id }
    );

  const postMutation = trpc.bill.post.useMutation({
    onSuccess: () => {
      utils.bill.getById.invalidate({ id: id! });
      utils.bill.list.invalidate();
      utils.purchaseOrder.list.invalidate(); // PO status may change
    },
  });

  const voidMutation = trpc.bill.void.useMutation({
    onSuccess: () => {
      utils.bill.getById.invalidate({ id: id! });
      utils.bill.list.invalidate();
      utils.purchaseOrder.list.invalidate(); // PO status may change
    },
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

    // FR-024: Prompt for void reason (accessible modal)
    const reason = await prompt({
      title: 'Void Bill',
      message: 'Please enter a reason for voiding this bill:',
      placeholder: 'Enter reason...',
      required: true,
    });
    if (!reason) {
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
          showBackButton
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

        {/* Feature: Linked Documents (DP <-> Final) */}
        {(bill.dpBill ||
          (bill.finalBills && bill.finalBills.length > 0)) && (
          <Card>
            <CardHeader>
              <CardTitle>Related Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Case 1: This is a Final Bill linked to a DP */}
                {bill.dpBill && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">
                      Less Down Payment
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        DP
                      </span>
                      <Link
                        to={`/bills/${bill.dpBill.id}`}
                        className="text-blue-600 hover:underline font-mono font-medium"
                      >
                        {bill.dpBill.invoiceNumber}
                      </Link>
                      <span className="text-gray-500 text-sm">
                        ({formatCurrency(Number(bill.dpBill.amount))})
                      </span>
                    </div>
                  </div>
                )}

                {/* Case 2: This is a DP Bill linked to Final Bill(s) */}
                {bill.finalBills && bill.finalBills.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">
                      Applied to Final Bill(s)
                    </p>
                    <div className="flex flex-col gap-2">
                      {bill.finalBills.map((finalBill) => (
                        <div
                          key={finalBill.id}
                          className="flex items-center gap-2"
                        >
                          <Link
                            to={`/bills/${finalBill.id}`}
                            className="text-blue-600 hover:underline font-mono font-medium"
                          >
                            {finalBill.invoiceNumber}
                          </Link>
                          <span className="text-gray-500 text-sm">
                            (
                            {formatCurrency(Number(finalBill.amount))}
                            )
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* FR-049: Price Variance Comparison */}
        {bill.order && bill.items && bill.items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Price Comparison (3-Way Match)</CardTitle>
            </CardHeader>
            <CardContent>
              <PriceVarianceCard
                items={bill.items.map((billItem, idx) => {
                  const poItem = bill.order?.items?.[idx];
                  return {
                    productName:
                      billItem.product?.name || 'Unknown Product',
                    poQuantity: poItem?.quantity || 0,
                    poPrice: Number(poItem?.price || 0),
                    billQuantity: billItem.quantity || 0,
                    billPrice: Number(billItem.price || 0),
                  };
                })}
              />
            </CardContent>
          </Card>
        )}

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
              {(bill.status === StatusSchema.enum.POSTED ||
                bill.status === StatusSchema.enum.PARTIALLY_PAID) &&
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
