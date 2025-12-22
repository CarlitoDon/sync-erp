import { useParams, Link, useNavigate } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm } from '@/components/ui/ConfirmModal';
import ActionButton from '@/components/ui/ActionButton';
import { formatCurrency, formatDate } from '@/utils/format';
import { BackButton } from '@/components/ui/BackButton';

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
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
    const confirmed = await confirm({
      title: 'Void Payment',
      message:
        'Are you sure you want to void this payment? The invoice balance will be restored.',
      confirmText: 'Yes, Void Payment',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () => voidMutation.mutateAsync({ id: payment.id }),
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

  // Invoice is included in the backend response but not in the base type
  // Use intersection to extend the type safely
  type InvoiceInfo = {
    invoiceNumber?: string;
    type?: string;
    partnerId?: string;
    partner?: { name?: string };
  };
  const invoice = (payment as { invoice?: InvoiceInfo }).invoice;

  const isVoided = payment.reference?.startsWith('[VOIDED]');
  const isBill = invoice?.type === 'BILL';
  const documentLabel = isBill ? 'Bill' : 'Invoice';
  const documentPath = isBill ? 'bills' : 'invoices';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton to="/finance" />
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
          {isVoided ? 'VOIDED' : 'COMPLETED'}
        </span>
      </div>

      {/* Payment Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">
          Payment Information
        </h2>
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
              {payment.method?.toLowerCase().replace('_', ' ') || '-'}
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
      </div>

      {/* Related Document Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">
          Related {documentLabel}
        </h2>
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
      </div>

      {/* Actions */}
      {!isVoided && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Actions</h2>
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
        </div>
      )}
    </div>
  );
}
