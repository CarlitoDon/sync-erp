import { useParams, Link, useNavigate } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { usePrompt } from '@/components/ui/PromptModal';
import ActionButton from '@/components/ui/ActionButton';
import { formatCurrency, formatDate } from '@/utils/format';
import { BackButton } from '@/components/ui/BackButton';
import { PageContainer } from '@/components/layout/PageLayout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/Card';

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data: payment, isLoading: loading } =
    trpc.payment.getById.useQuery(
      { id: id! },
      { enabled: !!id && !!currentCompany?.id }
    );

  const voidMutation = trpc.payment.void.useMutation({
    onSuccess: () => {
      utils.payment.getById.invalidate({ id: id! });
      utils.payment.list.invalidate();
    },
  });

  const handleVoid = async () => {
    if (!payment) return;

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
        'Are you sure you want to void this payment? The invoice balance will be restored.',
      confirmText: 'Yes, Void Payment',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () => voidMutation.mutateAsync({ id: payment.id, reason }),
      'Payment voided'
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">
          Loading payment details...
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Payment not found</div>
      </div>
    );
  }

  // Invoice is now properly included in tRPC response type
  const invoice = payment.invoice;

  const isVoided = payment.reference?.startsWith('[VOIDED]');
  // eslint-disable-next-line @sync-erp/no-hardcoded-enum -- InvoiceType comparison uses type from DB, but this is display logic
  const isBill = invoice?.type === 'BILL';
  const documentLabel = isBill ? 'Bill' : 'Invoice';
  const documentPath = isBill ? 'bills' : 'invoices';

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Payment Details
            </h1>
            <p className="text-sm text-gray-500">
              {payment.reference ||
                `Payment #${payment.id.slice(0, 8)}`}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
            isVoided
              ? 'bg-red-100 text-red-800'
              : 'bg-green-100 text-green-800'
          }`}
        >
          {/* eslint-disable-next-line @sync-erp/no-hardcoded-enum -- UI display labels, not database enum values */}
          {isVoided ? 'VOIDED' : 'COMPLETED'}
        </span>
      </div>

      {/* Payment Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(Number(payment.amount))}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Method</p>
              <p className="font-medium capitalize">
                {payment.method?.toLowerCase().replace('_', ' ') ||
                  '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="font-medium">
                {formatDate(payment.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Reference</p>
              <p className="font-mono text-sm">
                {payment.reference || '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Related Document Card */}
      <Card>
        <CardHeader>
          <CardTitle>Related {documentLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">
                {documentLabel} Number
              </p>
              <p className="font-medium">
                {invoice?.invoiceNumber ? (
                  <Link
                    to={`/${documentPath}/${payment.invoiceId}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-mono"
                  >
                    {invoice.invoiceNumber}
                  </Link>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">
                {isBill ? 'Supplier' : 'Customer'}
              </p>
              <p className="font-medium">
                {invoice?.partnerId ? (
                  <Link
                    to={`/${isBill ? 'suppliers' : 'customers'}/${invoice.partnerId}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {invoice.partner?.name || 'View Partner'}
                  </Link>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Type</p>
              <p className="font-medium">
                {isBill ? 'Bill Payment' : 'Invoice Receipt'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {!isVoided && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <ActionButton variant="danger" onClick={handleVoid}>
                Void Payment
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={() =>
                  navigate(`/${documentPath}/${payment.invoiceId}`)
                }
              >
                View {documentLabel}
              </ActionButton>
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
