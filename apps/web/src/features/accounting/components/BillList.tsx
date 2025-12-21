import { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { trpc, RouterOutputs } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm } from '@/components/ui/ConfirmModal';
import ActionButton from '@/components/ui/ActionButton';
import { formatCurrency, formatDate } from '@/utils/format';
import { PaymentHistoryList } from '@/features/accounting/components/PaymentHistoryList';
import FormModal from '@/components/ui/FormModal';
import Select from '@/components/ui/Select';
import {
  PaymentMethod,
  InvoiceStatusFilter,
  InvoiceStatus,
  paymentMethodOptions,
  defaultPaymentMethod,
  getInvoiceStatusDisplay,
  invoiceStatusFilterOptions,
} from '@/features/accounting/utils/financeEnums';
import { InvoiceStatusSchema as StatusSchema } from '@/types/api';

type Bill = RouterOutputs['bill']['list'][number];

interface BillListProps {
  filter?: {
    partnerId?: string;
    orderId?: string;
  };
}

export const BillList = ({ filter }: BillListProps) => {
  const confirm = useConfirm();
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  const { data: bills = [], isLoading: loading } =
    trpc.bill.list.useQuery(
      {
        status:
          filter?.partnerId || filter?.orderId
            ? undefined
            : undefined,
      },
      { enabled: !!currentCompany?.id }
    );

  const postMutation = trpc.bill.post.useMutation({
    onSuccess: () => utils.bill.list.invalidate(),
  });

  const voidMutation = trpc.bill.void.useMutation({
    onSuccess: () => utils.bill.list.invalidate(),
  });

  const paymentMutation = trpc.payment.create.useMutation({
    onSuccess: () => {
      utils.bill.list.invalidate();
      utils.payment.list.invalidate();
    },
  });

  const [filterStatus, setFilterStatus] =
    useState<InvoiceStatusFilter>('ALL');

  // Payment Modal State
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    defaultPaymentMethod
  );
  const [showHistory, setShowHistory] = useState<string | null>(null);

  const handlePost = async (id: string) => {
    await apiAction(
      () => postMutation.mutateAsync({ id }),
      'Bill posted!'
    );
  };

  const handleVoid = async (id: string) => {
    const confirmed = await confirm({
      title: 'Void Bill',
      message: 'Are you sure you want to void this bill?',
      confirmText: 'Yes, Void',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () => voidMutation.mutateAsync({ id }),
      'Bill voided'
    );
  };

  const openPaymentModal = (bill: Bill) => {
    setSelectedBill(bill);
    setPaymentAmount(Number(bill.balance));
    setPaymentMethod(defaultPaymentMethod);
  };

  const closePaymentModal = () => {
    setSelectedBill(null);
    setPaymentAmount(0);
  };

  const handlePayment = async () => {
    if (
      !selectedBill ||
      paymentAmount <= 0 ||
      paymentMutation.isPending
    )
      return;
    const result = await apiAction(
      () =>
        paymentMutation.mutateAsync({
          invoiceId: selectedBill.id, // Bills use same payment endpoint
          amount: paymentAmount,
          method: paymentMethod,
          businessDate: new Date(),
          correlationId: crypto.randomUUID(),
        }),
      'Payment recorded!'
    );
    if (result) {
      closePaymentModal();
    }
  };

  const getStatusColor = (status: InvoiceStatus) => {
    return getInvoiceStatusDisplay(status).color;
  };

  if (loading && bills.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
      </div>
    );
  }

  const filteredBills = bills.filter(
    (b) => filterStatus === 'ALL' || b.status === filterStatus
  );

  const outstandingAmount = bills
    .filter((b) => b.status === StatusSchema.enum.POSTED)
    .reduce((sum, b) => sum + Number(b.balance), 0);

  return (
    <div className="space-y-6">
      {/* Payment Modal */}
      <FormModal
        isOpen={selectedBill !== null}
        onClose={closePaymentModal}
        title="Record Payment"
        maxWidth="md"
      >
        {selectedBill && (
          <div className="space-y-4">
            {/* Bill Info Header */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">
                  Bill Number
                </span>
                <span className="font-mono font-medium">
                  {selectedBill.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">
                  Supplier
                </span>
                <span className="font-medium">
                  {selectedBill.partnerId || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">
                  Total Amount
                </span>
                <span className="font-medium">
                  {formatCurrency(Number(selectedBill.amount))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">
                  Outstanding Balance
                </span>
                <span className="font-bold text-red-600">
                  {formatCurrency(Number(selectedBill.balance))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">
                  Due Date
                </span>
                <span
                  className={
                    new Date(selectedBill.dueDate) < new Date()
                      ? 'text-red-600 font-bold'
                      : ''
                  }
                >
                  {formatDate(selectedBill.dueDate)}
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
                min={0}
                max={Number(selectedBill.balance)}
                value={paymentAmount}
                onChange={(e) =>
                  setPaymentAmount(parseFloat(e.target.value) || 0)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Max: {formatCurrency(Number(selectedBill.balance))}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <Select
                value={paymentMethod}
                onChange={(val) =>
                  setPaymentMethod(val as PaymentMethod)
                }
                options={paymentMethodOptions}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={closePaymentModal}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePayment}
                disabled={
                  paymentAmount <= 0 ||
                  paymentAmount > Number(selectedBill.balance) ||
                  paymentMutation.isPending
                }
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {paymentMutation.isPending
                  ? 'Processing...'
                  : 'Confirm Payment'}
              </button>
            </div>
          </div>
        )}
      </FormModal>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 uppercase">
            Total Bills
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {bills.length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 uppercase">
            Unpaid Bills
          </p>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {
              bills.filter(
                (b) => b.status === StatusSchema.enum.POSTED
              ).length
            }
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 uppercase">Paid</p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {
              bills.filter((b) => b.status === StatusSchema.enum.PAID)
                .length
            }
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 uppercase">
            Outstanding Amount
          </p>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {formatCurrency(outstandingAmount)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {invoiceStatusFilterOptions
            .filter((o) => o.value !== 'VOID')
            .map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilterStatus(opt.value)}
                className={`${
                  filterStatus === opt.value
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                {opt.value === 'ALL' ? 'All Bills' : opt.label}
              </button>
            ))}
        </nav>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Bill #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Supplier
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Balance
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Due Date
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredBills.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No bills found.
                </td>
              </tr>
            ) : (
              filteredBills.map((bill) => (
                <Fragment key={bill.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm">
                      <Link
                        to={`/bills/${bill.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {bill.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      {bill.partnerId || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {formatCurrency(Number(bill.amount))}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">
                      {formatCurrency(Number(bill.balance))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={
                          new Date(bill.dueDate) < new Date() &&
                          bill.status === StatusSchema.enum.POSTED
                            ? 'text-red-600 font-bold'
                            : ''
                        }
                      >
                        {formatDate(bill.dueDate)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(bill.status)}`}
                      >
                        {bill.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {bill.status === StatusSchema.enum.DRAFT && (
                        <>
                          <ActionButton
                            variant="primary"
                            onClick={() => handlePost(bill.id)}
                          >
                            Post
                          </ActionButton>
                          <ActionButton
                            variant="danger"
                            onClick={() => handleVoid(bill.id)}
                          >
                            Void
                          </ActionButton>
                        </>
                      )}
                      {bill.status === StatusSchema.enum.POSTED && (
                        <ActionButton
                          variant="success"
                          onClick={() => openPaymentModal(bill)}
                        >
                          Record Payment
                        </ActionButton>
                      )}
                      <ActionButton
                        variant="secondary"
                        onClick={() =>
                          setShowHistory(
                            showHistory === bill.id ? null : bill.id
                          )
                        }
                      >
                        {showHistory === bill.id
                          ? 'Hide History'
                          : 'History'}
                      </ActionButton>
                    </td>
                  </tr>
                  {showHistory === bill.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-4">
                        <PaymentHistoryList
                          invoiceId={bill.id}
                          totalAmount={Number(bill.amount)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
