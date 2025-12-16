import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  invoiceService,
  paymentService,
  CreatePaymentInput,
} from '../services/invoiceService';
import { useCompany } from '../../../contexts/CompanyContext';
import { apiAction } from '../../../hooks/useApiAction';
import { useConfirm } from '../../../components/ui/ConfirmModal';
import ActionButton from '../../../components/ui/ActionButton';
import FormModal from '../../../components/ui/FormModal';
import { formatCurrency, formatDate } from '../../../utils/format';
import { PaymentHistoryList } from '../components/PaymentHistoryList';

// Invoice type with order relation
interface InvoiceWithOrder {
  id: string;
  invoiceNumber: string | null;
  amount: number | string;
  balance: number | string;
  subtotal: number | string;
  taxAmount: number | string;
  taxRate: number;
  dueDate: Date | string;
  createdAt: Date | string;
  status: string;
  orderId?: string | null;
  order?: { id: string; orderNumber: string } | null;
  partnerId?: string;
  partner?: { name: string } | null;
  payments?: Array<{
    id: string;
    amount: number;
    method: string;
    createdAt: string;
  }>;
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const confirm = useConfirm();

  const [invoice, setInvoice] = useState<InvoiceWithOrder | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  // Payment Modal State
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] =
    useState<CreatePaymentInput['method']>('BANK_TRANSFER');
  const [showHistory, setShowHistory] = useState(false);

  const loadInvoice = async () => {
    if (!id || !currentCompany) return;
    setLoading(true);
    try {
      const data = await invoiceService.getById(id);
      setInvoice(data as InvoiceWithOrder);
      setPaymentAmount(Number(data.balance));
    } catch (error) {
      console.error('Failed to load invoice:', error);
      navigate('/invoices'); // Assuming there is an invoice list page, otherwise back to dashboard or sales
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [id, currentCompany]);

  const handlePost = async () => {
    if (!invoice) return;
    await apiAction(
      () => invoiceService.post(invoice.id),
      'Invoice posted!'
    );
    loadInvoice();
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
      () => invoiceService.void(invoice.id),
      'Invoice voided'
    );
    loadInvoice();
  };

  const handleRecordPayment = async () => {
    if (!invoice || paymentAmount <= 0) return;
    await apiAction(
      () =>
        paymentService.create({
          invoiceId: invoice.id,
          amount: paymentAmount,
          method: paymentMethod,
        }),
      'Payment recorded!'
    );
    setShowPayment(false);
    setPaymentAmount(0);
    loadInvoice();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'POSTED':
        return 'bg-yellow-100 text-yellow-800'; // Match new "Warning" style for outstanding
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'VOID':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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
          {/* Invoice Info Header */}
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
              <span className="text-sm text-gray-500">Customer</span>
              <span className="font-medium">
                {invoice.partner?.name || '-'}
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

          {/* Payment Form */}
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
            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(
                  e.target.value as CreatePaymentInput['method']
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CASH">Cash</option>
              <option value="CHECK">Check</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowPayment(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRecordPayment}
              disabled={
                paymentAmount <= 0 ||
                paymentAmount > Number(invoice.balance)
              }
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Confirm Payment
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
              onClick={() => navigate('/sales-orders')} // Using SO list as main nav for now? Or implement Invoice List? Assuming generic back
              className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              Invoice {invoice.invoiceNumber}
            </h1>
            <p className="text-gray-500">
              {invoice.partner ? (
                <Link
                  to={`/customers/${invoice.partnerId}`}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {invoice.partner.name}
                </Link>
              ) : (
                'Unknown Customer'
              )}
            </p>
          </div>
          <span
            className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(invoice.status)}`}
          >
            {invoice.status}
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
              <p className="text-sm text-gray-500">Source SO</p>
              {invoice.order ? (
                <Link
                  to={`/sales-orders/${invoice.order.id}`}
                  className="font-mono font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {invoice.order.orderNumber}
                </Link>
              ) : (
                <span className="text-gray-400 italic">
                  Manual Entry
                </span>
              )}
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
              <p className="text-sm text-gray-500">Subtotal</p>
              <p className="font-medium">
                {formatCurrency(Number(invoice.subtotal))}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">
                Tax ({invoice.taxRate}%)
              </p>
              <p className="font-medium">
                {formatCurrency(Number(invoice.taxAmount))}
              </p>
            </div>
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
            {invoice.status === 'DRAFT' && (
              <>
                <ActionButton variant="primary" onClick={handlePost}>
                  Post Invoice
                </ActionButton>
                <ActionButton variant="danger" onClick={handleVoid}>
                  Void
                </ActionButton>
              </>
            )}
            {invoice.status === 'POSTED' &&
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
            {(invoice.payments?.length || 0) > 0 && (
              <ActionButton
                variant="secondary"
                onClick={() => setShowHistory(true)}
              >
                View Payment History ({invoice.payments?.length})
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
