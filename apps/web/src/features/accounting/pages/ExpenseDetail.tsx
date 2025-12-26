import { useParams, Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { formatCurrency, formatDate } from '@/utils/format';
import { RecordPaymentModal } from '@/features/accounting/components/RecordPaymentModal';
import { PaymentHistoryModal } from '@/features/accounting/components/PaymentHistoryModal';
import { useState } from 'react';
import { getBillStatusDisplay } from '@/features/accounting/utils/financeEnums'; // Reuse bill status logic
import { InvoiceStatusSchema } from '@/types/api';
import { PageContainer } from '@/components/layout/PageLayout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  PageHeader,
  ActionButton,
  LoadingState,
  EmptyState,
} from '@/components/ui';

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  const { data: expense, isLoading } = trpc.expense.byId.useQuery(
    id!,
    { enabled: !!id && !!currentCompany?.id }
  );

  const postMutation = trpc.expense.post.useMutation({
    onSuccess: () => utils.expense.byId.invalidate(id!),
  });

  const [showPayment, setShowPayment] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handlePost = async () => {
    if (!expense) return;
    await apiAction(
      () => postMutation.mutateAsync(expense.id),
      'Expense posted!'
    );
  };

  if (isLoading) return <LoadingState />;
  if (!expense) return <EmptyState message="Expense not found" />;

  const statusDisplay = getBillStatusDisplay(expense.status); // Safe to reuse as logic is based on InvoiceStatus

  return (
    <>
      <RecordPaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        invoiceId={expense.id}
        invoiceNumber={expense.invoiceNumber || ''}
        balance={Number(expense.balance)}
        dueDate={
          expense.dueDate ? new Date(expense.dueDate) : new Date()
        }
        documentType="bill" // Treat as bill for payment recording
        onSuccess={() => utils.expense.byId.invalidate(id!)}
      />

      <PaymentHistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        invoiceId={expense.id}
        totalAmount={Number(expense.amount)}
      />

      <PageContainer>
        <PageHeader
          title={`Expense ${expense.invoiceNumber}`}
          subtitle={
            expense.supplierInvoiceNumber
              ? `Ref: ${expense.supplierInvoiceNumber}`
              : undefined
          }
          actions={
            <span
              className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusDisplay.color}`}
            >
              {statusDisplay.label}
            </span>
          }
        />

        {/* Details & Items */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Expense Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Payee</p>
                    <p className="font-medium">
                      {expense.partnerId ? (
                        <Link
                          to={`/suppliers/${expense.partnerId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {expense.partner?.name}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-medium">
                      {formatDate(expense.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Due Date</p>
                    <p className="font-medium">
                      {expense.dueDate
                        ? formatDate(expense.dueDate)
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="font-medium">{expense.status}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase">
                        Description
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase">
                        Qty
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase">
                        Price
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {expense.items?.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="py-2 text-sm text-gray-900">
                          {item.description}
                        </td>
                        <td className="py-2 text-sm text-gray-900 text-right">
                          {item.quantity}
                        </td>
                        <td className="py-2 text-sm text-gray-900 text-right">
                          {formatCurrency(Number(item.price))}
                        </td>
                        <td className="py-2 text-sm text-gray-900 text-right">
                          {formatCurrency(Number(item.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-medium text-gray-900">Summary</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>
                    {formatCurrency(
                      Number(expense.subtotal || expense.amount)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tax</span>
                  <span>
                    {formatCurrency(Number(expense.taxAmount || 0))}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t">
                  <span className="font-bold">Total</span>
                  <span className="text-xl font-bold">
                    {formatCurrency(Number(expense.amount))}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 text-red-600 font-medium">
                  <span>Balance Due</span>
                  <span>
                    {formatCurrency(Number(expense.balance))}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {expense.status ===
                    InvoiceStatusSchema.enum.DRAFT && (
                    <ActionButton
                      variant="primary"
                      onClick={handlePost}
                      disabled={postMutation.isPending}
                    >
                      {postMutation.isPending
                        ? 'Posting...'
                        : 'Post Expense'}
                    </ActionButton>
                  )}
                  {expense.status ===
                    InvoiceStatusSchema.enum.POSTED &&
                    Number(expense.balance) > 0 && (
                      <ActionButton
                        variant="success"
                        onClick={() => setShowPayment(true)}
                      >
                        Record Payment
                      </ActionButton>
                    )}
                  <ActionButton
                    variant="secondary"
                    onClick={() => setShowHistory(true)}
                  >
                    View Payments
                  </ActionButton>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
