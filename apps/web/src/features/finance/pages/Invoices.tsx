import { useState } from 'react';
import {
  invoiceService,
  paymentService,
  Invoice,
  CreatePaymentInput,
} from '../services/invoiceService';
import { useCompany } from '../../../contexts/CompanyContext';
import { useCompanyData } from '../../../hooks/useCompanyData';
import { apiAction } from '../../../hooks/useApiAction';
import { useConfirm } from '../../../components/ui/ConfirmModal';
import ActionButton from '../../../components/ui/ActionButton';
import { formatCurrency, formatDate } from '../utils/format';

export default function Invoices() {
  const { currentCompany } = useCompany();
  const confirm = useConfirm();

  const {
    data: invoices,
    loading,
    refresh: loadInvoices,
  } = useCompanyData<Invoice[]>(invoiceService.list, []);

  const [showPayment, setShowPayment] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] =
    useState<CreatePaymentInput['method']>('BANK_TRANSFER');

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

  const handlePayment = async (invoiceId: string) => {
    if (paymentAmount <= 0) return;
    const result = await apiAction(
      () =>
        paymentService.create({
          invoiceId,
          amount: paymentAmount,
          method: paymentMethod,
        }),
      'Payment recorded!'
    );
    if (result) {
      setShowPayment(null);
      setPaymentAmount(0);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Please select a company to view invoices.
      </div>
    );
  }

  const outstandingAmount = invoices
    .filter((inv) => inv.status === 'POSTED')
    .reduce((sum, inv) => sum + Number(inv.balance), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Invoices
          </h1>
          <p className="text-gray-500">
            Accounts Receivable - Customer invoices for{' '}
            {currentCompany.name}
          </p>
        </div>
      </div>

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
            {invoices.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No invoices found for this company.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <>
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4">
                      {invoice.partner?.name || '-'}
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
                          onClick={() => {
                            setShowPayment(invoice.id);
                            setPaymentAmount(Number(invoice.balance));
                          }}
                          variant="success"
                        >
                          Record Payment
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                  {showPayment === invoice.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Amount
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={Number(invoice.balance)}
                              step={0.01}
                              value={paymentAmount}
                              onChange={(e) =>
                                setPaymentAmount(
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-40 px-3 py-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Method
                            </label>
                            <select
                              value={paymentMethod}
                              onChange={(e) =>
                                setPaymentMethod(
                                  e.target
                                    .value as CreatePaymentInput['method']
                                )
                              }
                              className="w-40 px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              <option value="BANK_TRANSFER">
                                Bank Transfer
                              </option>
                              <option value="CASH">Cash</option>
                              <option value="CHECK">Check</option>
                              <option value="CREDIT_CARD">
                                Credit Card
                              </option>
                              <option value="OTHER">Other</option>
                            </select>
                          </div>
                          <div className="flex gap-2 mt-6">
                            <button
                              onClick={() =>
                                handlePayment(invoice.id)
                              }
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                              Confirm Payment
                            </button>
                            <button
                              onClick={() => setShowPayment(null)}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
