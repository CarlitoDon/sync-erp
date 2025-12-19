import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { billService } from '@/features/finance/services/billService';
import {
  paymentService,
  CreatePaymentInput,
} from '@/features/finance/services/invoiceService';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm } from '@/components/ui/ConfirmModal';
import ActionButton from '@/components/ui/ActionButton';
import FormModal from '@/components/ui/FormModal';
import { formatCurrency, formatDate } from '@/utils/format';
import { PaymentHistoryList } from '@/features/finance/components/PaymentHistoryList';
import Select from '@/components/ui/Select';

// Bill type with order relation (extends the API response)
interface BillWithOrder {
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

export default function BillDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const confirm = useConfirm();

  const [bill, setBill] = useState<BillWithOrder | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment Modal State
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] =
    useState<CreatePaymentInput['method']>('BANK_TRANSFER');
  const [showHistory, setShowHistory] = useState(false);

  const loadBill = async () => {
    if (!id || !currentCompany) return;
    setLoading(true);
    try {
      const data = await billService.getById(id);
      setBill(data as BillWithOrder);
      setPaymentAmount(Number(data.balance));
    } catch (error) {
      console.error('Failed to load bill:', error);
      navigate('/bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBill();
  }, [id, currentCompany]);

  const handlePost = async () => {
    if (!bill) return;
    await apiAction(() => billService.post(bill.id), 'Bill posted!');
    loadBill();
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
    await apiAction(() => billService.void(bill.id), 'Bill voided');
    loadBill();
  };

  const handleRecordPayment = async () => {
    if (!bill || paymentAmount <= 0) return;
    await apiAction(
      () =>
        paymentService.create({
          invoiceId: bill.id,
          amount: paymentAmount,
          method: paymentMethod,
        }),
      'Payment recorded!'
    );
    setShowPayment(false);
    setPaymentAmount(0);
    loadBill();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'POSTED':
        return 'bg-blue-100 text-blue-800';
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
          {/* Bill Info Header */}
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
              <span className="text-sm text-gray-500">Supplier</span>
              <span className="font-medium">
                {bill.partner?.name || '-'}
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
                setPaymentMethod(val as CreatePaymentInput['method'])
              }
              options={[
                { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                { value: 'CASH', label: 'Cash' },
                { value: 'CHECK', label: 'Check' },
                { value: 'CREDIT_CARD', label: 'Credit Card' },
                { value: 'OTHER', label: 'Other' },
              ]}
            />
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
                paymentAmount > Number(bill.balance)
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
              onClick={() => navigate('/bills')}
              className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
            >
              ← Back to Bills
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              Bill {bill.invoiceNumber}
            </h1>
            <p className="text-gray-500">
              {bill.partner ? (
                <Link
                  to={`/suppliers/${bill.partnerId}`}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {bill.partner.name}
                </Link>
              ) : (
                'Unknown Supplier'
              )}
            </p>
          </div>
          <span
            className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(bill.status)}`}
          >
            {bill.status}
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
              <p className="text-sm text-gray-500">Source PO</p>
              {bill.order ? (
                <Link
                  to={`/purchase-orders/${bill.order.id}`}
                  className="font-mono font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {bill.order.orderNumber}
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
              <p className="text-sm text-gray-500">Subtotal</p>
              <p className="font-medium">
                {formatCurrency(Number(bill.subtotal))}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">
                Tax ({bill.taxRate}%)
              </p>
              <p className="font-medium">
                {formatCurrency(Number(bill.taxAmount))}
              </p>
            </div>
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
            {bill.status === 'DRAFT' && (
              <>
                <ActionButton variant="primary" onClick={handlePost}>
                  Post Bill
                </ActionButton>
                <ActionButton variant="danger" onClick={handleVoid}>
                  Void
                </ActionButton>
              </>
            )}
            {bill.status === 'POSTED' && Number(bill.balance) > 0 && (
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
            {(bill.payments?.length || 0) > 0 && (
              <ActionButton
                variant="secondary"
                onClick={() => setShowHistory(true)}
              >
                View Payment History ({bill.payments?.length})
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
