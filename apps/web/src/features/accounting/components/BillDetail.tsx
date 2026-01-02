import { useParams, Link, useNavigate } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from '@/utils/format';
import { RecordPaymentModal } from '@/features/accounting/components/RecordPaymentModal';
import { PaymentHistoryModal } from '@/features/accounting/components/PaymentHistoryModal';
import { useState } from 'react';
import { getBillStatusDisplay } from '@/features/accounting/utils/financeEnums';
import { InvoiceStatusSchema as StatusSchema } from '@/types/api';
import { getPaymentTermLabel } from '@sync-erp/shared';
import { PageContainer } from '@/components/layout/PageLayout';
import { PriceVarianceCard } from './PriceVarianceCard';
import { Timeline, TimelineEvent } from '@/components/ui/Timeline';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  ActionButton,
  BackButton,
  useConfirm,
  usePrompt,
  LoadingState,
  EmptyState,
} from '@/components/ui';

export default function BillDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  const deleteMutation = trpc.bill.delete.useMutation({
    onSuccess: () => {
      utils.bill.list.invalidate();
      utils.purchaseOrder.list.invalidate();
      navigate('/bills');
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

  const handleDelete = async () => {
    if (!bill) return;

    const confirmed = await confirm({
      title: 'Delete Bill',
      message:
        'Are you sure you want to delete this draft bill? This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () => deleteMutation.mutateAsync({ id: bill.id }),
      'Bill deleted successfully'
    );
  };

  if (loading) {
    return <LoadingState />;
  }

  if (!bill) {
    return <EmptyState message="Bill not found" />;
  }

  const statusDisplay = getBillStatusDisplay(bill.status);
  const isOverdue =
    new Date(bill.dueDate) < new Date() &&
    bill.status === StatusSchema.enum.POSTED;

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

      {/* Two-Column Layout */}
      <PageContainer>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {bill.invoiceNumber}
              </h1>
              {bill.partnerId ? (
                <Link
                  to={`/suppliers/${bill.partnerId}`}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {bill.partner?.name || 'View Supplier'}
                </Link>
              ) : (
                <p className="text-sm text-gray-500">
                  Unknown Supplier
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <span
              className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusDisplay.color}`}
            >
              {statusDisplay.label}
            </span>
            {bill.isDownPayment && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                DP Bill
              </span>
            )}
          </div>
        </div>

        {/* Overdue Warning */}
        {isOverdue && Number(bill.balance) > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg flex items-start gap-3 mb-6">
            <span className="text-red-600 text-xl">⚠️</span>
            <div>
              <p className="font-semibold text-red-800">
                Payment Overdue
              </p>
              <p className="text-sm text-red-700">
                This bill was due on {formatDate(bill.dueDate)}.
                Outstanding balance:{' '}
                {formatCurrency(Number(bill.balance))}
              </p>
            </div>
          </div>
        )}

        {/* Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT SIDEBAR - Sticky */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6 space-y-4">
              {/* Bill Info Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    📄 Bill Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Bill Number
                      </p>
                      <p className="font-mono font-medium text-sm">
                        {bill.invoiceNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Created
                      </p>
                      <p className="font-medium text-sm">
                        {formatDate(bill.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Purchase Order
                    </p>
                    {bill.orderId ? (
                      <Link
                        to={`/purchase-orders/${bill.orderId}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-sm"
                      >
                        {bill.order?.orderNumber || bill.orderId}
                      </Link>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Due Date
                      </p>
                      <p
                        className={`font-medium text-sm ${
                          isOverdue ? 'text-red-600' : ''
                        }`}
                      >
                        {formatDate(bill.dueDate)}
                      </p>
                    </div>
                    {bill.paymentTermsString && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Terms
                        </p>
                        <p className="font-medium text-sm">
                          {getPaymentTermLabel(
                            bill.paymentTermsString
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Amount Summary Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    💰 Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">
                      Total Amount
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(Number(bill.amount))}
                    </span>
                  </div>
                  <hr />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">
                      Paid
                    </span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(
                        Number(bill.amount) - Number(bill.balance)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">
                      Balance Due
                    </span>
                    <span
                      className={`text-lg font-bold ${
                        Number(bill.balance) > 0
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      {formatCurrency(Number(bill.balance))}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Linked Documents Card */}
              {(bill.dpBill ||
                (bill.finalBills && bill.finalBills.length > 0) ||
                bill.fulfillment) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      🔗 Related
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* DP Bill link */}
                    {bill.dpBill && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                          Less Down Payment
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            DP
                          </span>
                          <Link
                            to={`/bills/${bill.dpBill.id}`}
                            className="text-blue-600 hover:underline font-mono text-sm"
                          >
                            {bill.dpBill.invoiceNumber}
                          </Link>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatCurrency(Number(bill.dpBill.amount))}
                        </p>
                      </div>
                    )}

                    {/* Final Bills link */}
                    {bill.finalBills &&
                      bill.finalBills.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                            Applied to Final Bill(s)
                          </p>
                          {bill.finalBills.map((finalBill) => (
                            <div
                              key={finalBill.id}
                              className="flex items-center gap-2 mt-1"
                            >
                              <Link
                                to={`/bills/${finalBill.id}`}
                                className="text-blue-600 hover:underline font-mono text-sm"
                              >
                                {finalBill.invoiceNumber}
                              </Link>
                              <span className="text-xs text-gray-500">
                                (
                                {formatCurrency(
                                  Number(finalBill.amount)
                                )}
                                )
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                    {/* GRN link */}
                    {bill.fulfillment && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                          Goods Receipt
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            GRN
                          </span>
                          <Link
                            to={`/receipts/${bill.fulfillment.id}`}
                            className="text-blue-600 hover:underline font-mono text-sm"
                          >
                            {bill.fulfillment.number}
                          </Link>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Actions Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    ⚡ Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    {bill.status === StatusSchema.enum.DRAFT && (
                      <>
                        <ActionButton
                          variant="primary"
                          onClick={handlePost}
                          className="w-full"
                        >
                          ✓ Post Bill
                        </ActionButton>
                        <ActionButton
                          variant="danger"
                          onClick={handleDelete}
                          className="w-full"
                        >
                          🗑 Delete
                        </ActionButton>
                      </>
                    )}
                    {(bill.status === StatusSchema.enum.POSTED ||
                      bill.status ===
                        StatusSchema.enum.PARTIALLY_PAID) && (
                      <>
                        {Number(bill.balance) > 0 && (
                          <ActionButton
                            variant="success"
                            onClick={() => setShowPayment(true)}
                            className="w-full"
                          >
                            💳 Record Payment
                          </ActionButton>
                        )}
                        <ActionButton
                          variant="danger"
                          onClick={handleVoid}
                          className="w-full"
                        >
                          ✕ Void Bill
                        </ActionButton>
                      </>
                    )}
                    <ActionButton
                      variant="secondary"
                      onClick={() => setShowHistory(true)}
                      className="w-full"
                    >
                      📜 Payment History
                    </ActionButton>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* RIGHT MAIN CONTENT */}
          <div className="lg:col-span-2 space-y-6">
            {/* FR-049: Price Variance Comparison */}
            {bill.order && bill.items && bill.items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    📊 Price Comparison (3-Way Match)
                  </CardTitle>
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

            {/* Bill Items (if no 3-way match data, show simple items list) */}
            {(!bill.order ||
              !bill.items ||
              bill.items.length === 0) &&
              bill.amount && (
                <Card>
                  <CardHeader>
                    <CardTitle>📦 Bill Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-lg font-medium">
                        Total Bill Amount
                      </p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {formatCurrency(Number(bill.amount))}
                      </p>
                      {bill.isDownPayment && (
                        <p className="text-sm text-purple-600 mt-2">
                          This is a Down Payment Bill
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Additional info card for context */}
            <Card>
              <CardHeader>
                <CardTitle>📋 Bill Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <Timeline
                  events={(() => {
                    const events: TimelineEvent[] = [];

                    // Created
                    events.push({
                      id: 'created',
                      title: 'Created',
                      description: formatDateTime(bill.createdAt),
                      color: 'blue',
                    });

                    // Posted
                    if (bill.status !== StatusSchema.enum.DRAFT) {
                      events.push({
                        id: 'posted',
                        title: 'Posted',
                        description: `${formatDateTime(bill.updatedAt)} • Bill is now payable`,
                        color: 'green',
                      });
                    }

                    // Fully Paid
                    if (bill.status === StatusSchema.enum.PAID) {
                      events.push({
                        id: 'paid',
                        title: 'Fully Paid',
                        description: `${formatDateTime(bill.updatedAt)} • All payments received`,
                        color: 'emerald',
                      });
                    }

                    // Voided
                    if (bill.status === StatusSchema.enum.VOID) {
                      events.push({
                        id: 'voided',
                        title: 'Voided',
                        description: `${formatDateTime(bill.updatedAt)} • Bill has been voided`,
                        color: 'red',
                      });
                    }

                    // Due Date
                    events.push({
                      id: 'due-date',
                      title: 'Due Date',
                      description: `${formatDate(bill.dueDate)}${isOverdue ? ' (Overdue)' : ''}`,
                      color: isOverdue ? 'red' : 'gray',
                      descriptionClassName: isOverdue
                        ? 'text-red-600'
                        : 'text-gray-500',
                    });

                    return events;
                  })()}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
