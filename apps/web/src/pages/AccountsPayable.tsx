import { useState } from 'react';
import { billService, Bill } from '../services/billService';
import {
  paymentService,
  CreatePaymentInput,
} from '../services/invoiceService';
import { useCompany } from '../contexts/CompanyContext';
import { useCompanyData } from '../hooks/useCompanyData';
import { apiAction } from '../hooks/useApiAction';
import { useConfirm } from '../components/ConfirmModal';
import ActionButton from '../components/ActionButton';
import { formatCurrency, formatDate } from '../utils/format';

export default function AccountsPayable() {
  const { currentCompany } = useCompany();
  const confirm = useConfirm();

  const {
    data: bills,
    loading,
    refresh: loadBills,
  } = useCompanyData<Bill[]>(billService.list, []);

  const [filterStatus, setFilterStatus] = useState<
    'ALL' | 'DRAFT' | 'POSTED' | 'PAID' | 'VOID'
  >('ALL');

  // Payment Modal State
  const [showPayment, setShowPayment] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] =
    useState<CreatePaymentInput['method']>('BANK_TRANSFER');

  const handlePost = async (id: string) => {
    await apiAction(() => billService.post(id), 'Bill posted!');
    loadBills();
  };

  const handleVoid = async (id: string) => {
    const confirmed = await confirm({
      title: 'Void Bill',
      message: 'Are you sure you want to void this bill?',
      confirmText: 'Yes, Void',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(() => billService.void(id), 'Bill voided');
    loadBills();
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
      loadBills();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'POSTED':
        return 'bg-blue-100 text-blue-800'; // Posted means Unpaid/Open
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
      <div className="p-8 text-center text-gray-500">
        Loading bills...
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="p-8 text-center text-gray-500">
        Please select a company.
      </div>
    );
  }

  const filteredBills = bills.filter(
    (b) => filterStatus === 'ALL' || b.status === filterStatus
  );
  const outstandingAmount = bills
    .filter((b) => b.status === 'POSTED')
    .reduce((sum, b) => sum + Number(b.balance), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Accounts Payable
          </h1>
          <p className="text-gray-500">
            Manage Supplier Bills and Payments
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 uppercase">
            Unpaid Bills
          </p>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {bills.filter((b) => b.status === 'POSTED').length}
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
          {['ALL', 'DRAFT', 'POSTED', 'PAID'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status as any)}
              className={`${
                filterStatus === status
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              {status === 'ALL' ? 'All Bills' : status}
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
                <>
                  <tr key={bill.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm">
                      {bill.invoiceNumber}
                    </td>
                    <td className="px-6 py-4">
                      {bill.partner?.name || '-'}
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
                          bill.status === 'POSTED'
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
                      {bill.status === 'DRAFT' && (
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
                      {bill.status === 'POSTED' && (
                        <ActionButton
                          variant="success"
                          onClick={() => {
                            setShowPayment(bill.id);
                            setPaymentAmount(Number(bill.balance));
                          }}
                        >
                          Record Payment
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                  {/* Inline Payment Form (Reuse from Invoices) */}
                  {showPayment === bill.id && (
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
                              max={Number(bill.balance)}
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
                            <ActionButton
                              variant="success"
                              onClick={() => handlePayment(bill.id)}
                            >
                              Confirm
                            </ActionButton>
                            <ActionButton
                              variant="secondary"
                              onClick={() => setShowPayment(null)}
                            >
                              Cancel
                            </ActionButton>
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
