import { useState, useEffect, useCallback, Fragment } from 'react';
import { Link } from 'react-router-dom';
import {
  invoiceService,
  paymentService,
  Invoice,
  CreatePaymentInput,
} from '../services/invoiceService';
import { useCompanyData } from '../../../hooks/useCompanyData';
import { apiAction } from '../../../hooks/useApiAction';
import { useConfirm } from '../../../components/ui/ConfirmModal';
import ActionButton from '../../../components/ui/ActionButton';
import { formatCurrency, formatDate } from '../../../utils/format';
import { PaymentHistoryList } from './PaymentHistoryList';
import FormModal from '../../../components/ui/FormModal';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Button } from '../../../components/ui/button';

// Extend Invoice type with order
interface InvoiceWithOrder extends Invoice {
  order?: { orderNumber: string } | null;
}

interface InvoiceListProps {
  filter?: {
    partnerId?: string;
    orderId?: string;
  };
}

export const InvoiceList = ({ filter }: InvoiceListProps) => {
  const confirm = useConfirm();

  const {
    data: invoices,
    loading,
    refresh: loadInvoices,
  } = useCompanyData<Invoice[]>(
    useCallback(() => invoiceService.list(filter), [filter]),
    []
  );

  const [filterStatus, setFilterStatus] = useState<
    'ALL' | 'DRAFT' | 'POSTED' | 'PAID' | 'VOID'
  >('ALL');

  // Payment Modal State
  const [selectedInvoice, setSelectedInvoice] =
    useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] =
    useState<CreatePaymentInput['method']>('BANK_TRANSFER');
  const [businessDate, setBusinessDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState<string | null>(null);

  useEffect(() => {
    loadInvoices();
  }, [filter, loadInvoices]);

  const handlePost = async (id: string) => {
    await apiAction(() => invoiceService.post(id), 'Invoice posted!');
    loadInvoices();
  };

  const handleVoid = async (id: string) => {
    const confirmed = await confirm({
      title: 'Void Invoice',
      message: 'Are you sure you want to void this invoice?',
      confirmText: 'Yes, Void',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(() => invoiceService.void(id), 'Invoice voided');
    loadInvoices();
  };

  const openPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(Number(invoice.balance));
    setPaymentMethod('BANK_TRANSFER');
    setBusinessDate(new Date().toISOString().split('T')[0]);
  };

  const closePaymentModal = () => {
    setSelectedInvoice(null);
    setPaymentAmount(0);
    setIsSubmitting(false);
  };

  const handlePayment = async () => {
    if (!selectedInvoice || paymentAmount <= 0 || isSubmitting) return;
    setIsSubmitting(true);
    const result = await apiAction(
      () =>
        paymentService.create({
          invoiceId: selectedInvoice.id,
          amount: paymentAmount,
          method: paymentMethod,
          date: businessDate,
        }),
      'Payment recorded!'
    );
    setIsSubmitting(false);
    if (result) {
      closePaymentModal();
      loadInvoices();
    }
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

  if (loading && invoices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const filteredInvoices = invoices.filter(
    (inv) => filterStatus === 'ALL' || inv.status === filterStatus
  );

  const outstandingAmount = invoices
    .filter((inv) => inv.status === 'POSTED')
    .reduce((sum, inv) => sum + Number(inv.balance), 0);

  return (
    <div className="space-y-6">
      {/* Payment Modal */}
      <FormModal
        isOpen={selectedInvoice !== null}
        onClose={closePaymentModal}
        title="Record Payment"
        maxWidth="md"
      >
        {selectedInvoice && (
          <div className="space-y-4">
            {/* Invoice Info Header */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">
                  Invoice Number
                </span>
                <span className="font-mono font-medium">
                  {selectedInvoice.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">
                  Customer
                </span>
                <span className="font-medium">
                  {selectedInvoice.partner?.name || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">
                  Total Amount
                </span>
                <span className="font-medium">
                  {formatCurrency(Number(selectedInvoice.amount))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">
                  Outstanding Balance
                </span>
                <span className="font-bold text-red-600">
                  {formatCurrency(Number(selectedInvoice.balance))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">
                  Due Date
                </span>
                <span
                  className={
                    new Date(selectedInvoice.dueDate) < new Date()
                      ? 'text-red-600 font-bold'
                      : ''
                  }
                >
                  {formatDate(selectedInvoice.dueDate)}
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
                max={Number(selectedInvoice.balance)}
                step={0.01}
                value={paymentAmount}
                onChange={(e) =>
                  setPaymentAmount(parseFloat(e.target.value) || 0)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Max: {formatCurrency(Number(selectedInvoice.balance))}
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

            {/* Business Date (FR-005a) */}
            <DatePicker
              label="Business Date *"
              value={businessDate}
              onChange={setBusinessDate}
            />

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={closePaymentModal}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <Button
                variant="primary"
                onClick={handlePayment}
                isLoading={isSubmitting}
                disabled={
                  paymentAmount <= 0 ||
                  paymentAmount > Number(selectedInvoice.balance)
                }
                className="bg-green-600 hover:bg-green-700"
              >
                Confirm Payment
              </Button>
            </div>
          </div>
        )}
      </FormModal>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 uppercase">
            Total Invoices
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {invoices.length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 uppercase">
            Outstanding
          </p>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {invoices.filter((i) => i.status === 'POSTED').length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 uppercase">Paid</p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {invoices.filter((i) => i.status === 'PAID').length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 uppercase">
            Outstanding Amount
          </p>
          <p className="text-2xl font-bold text-primary-600 mt-2">
            {formatCurrency(outstandingAmount)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {['ALL', 'DRAFT', 'POSTED', 'PAID', 'VOID'].map(
            (status) => (
              <button
                key={status}
                onClick={() =>
                  setFilterStatus(
                    status as
                      | 'ALL'
                      | 'DRAFT'
                      | 'POSTED'
                      | 'PAID'
                      | 'VOID'
                  )
                }
                className={`${
                  filterStatus === status
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                {status === 'ALL' ? 'All Invoices' : status}
              </button>
            )
          )}
        </nav>
      </div>

      {/* Invoice Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Invoice #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Source SO
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
            {filteredInvoices.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No invoices found.
                </td>
              </tr>
            ) : (
              filteredInvoices.map((invoice) => (
                <Fragment key={invoice.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm">
                      <Link
                        to={`/invoices/${invoice.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      {invoice.partner?.name || '-'}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-500">
                      {(invoice as InvoiceWithOrder).order
                        ?.orderNumber || (
                        <span className="text-gray-400 italic">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {formatCurrency(Number(invoice.amount))}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">
                      {formatCurrency(Number(invoice.balance))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={
                          new Date(invoice.dueDate) < new Date() &&
                          invoice.status === 'POSTED'
                            ? 'text-red-600 font-bold'
                            : ''
                        }
                      >
                        {formatDate(invoice.dueDate)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {invoice.status === 'DRAFT' && (
                        <>
                          <ActionButton
                            onClick={() => handlePost(invoice.id)}
                            variant="primary"
                          >
                            Post
                          </ActionButton>
                          <ActionButton
                            onClick={() => handleVoid(invoice.id)}
                            variant="danger"
                          >
                            Void
                          </ActionButton>
                        </>
                      )}
                      {invoice.status === 'POSTED' && (
                        <ActionButton
                          onClick={() => openPaymentModal(invoice)}
                          variant="success"
                        >
                          Record Payment
                        </ActionButton>
                      )}
                      <ActionButton
                        variant="secondary"
                        onClick={() =>
                          setShowHistory(
                            showHistory === invoice.id
                              ? null
                              : invoice.id
                          )
                        }
                      >
                        {showHistory === invoice.id
                          ? 'Hide History'
                          : 'History'}
                      </ActionButton>
                    </td>
                  </tr>
                  {showHistory === invoice.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={8} className="px-6 py-4">
                        <PaymentHistoryList
                          invoiceId={invoice.id}
                          totalAmount={invoice.amount}
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
