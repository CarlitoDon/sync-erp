import { useState, useEffect, useCallback, Fragment } from 'react';
import { Link } from 'react-router-dom';
import {
  billService,
  Bill,
} from '../services/billService';
import {
  paymentService,
  CreatePaymentInput,
} from '../services/invoiceService';
import { useCompanyData } from '../../../hooks/useCompanyData';
import { apiAction } from '../../../hooks/useApiAction';
import { useConfirm } from '../../../components/ui/ConfirmModal';
import ActionButton from '../../../components/ui/ActionButton';
import { formatCurrency, formatDate } from '../../../utils/format';
import { PaymentHistoryList } from './PaymentHistoryList';

// Extend Bill type with order relation
interface BillWithOrder extends Bill {
  order?: { orderNumber: string } | null;
}

interface BillListProps {
  filter?: {
    partnerId?: string;
    orderId?: string;
  };
}

export const BillList = ({ filter }: BillListProps) => {
  const confirm = useConfirm();

  const {
    data: bills,
    loading,
    refresh: loadBills,
  } = useCompanyData<Bill[]>(
    useCallback(() => billService.list(filter), [filter]),
    []
  );

  const [filterStatus, setFilterStatus] = useState<
    'ALL' | 'DRAFT' | 'POSTED' | 'PAID' | 'VOID'
  >('ALL');

  // Payment Modal State
  const [showPayment, setShowPayment] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] =
    useState<CreatePaymentInput['method']>('BANK_TRANSFER');
  const [showHistory, setShowHistory] = useState<string | null>(null);

  useEffect(() => {
    loadBills();
  }, [filter, loadBills]);

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
    .filter((b) => b.status === 'POSTED')
    .reduce((sum, b) => sum + Number(b.balance), 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 uppercase">Total Bills</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {bills.length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 uppercase">
            Unpaid Bills
          </p>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {bills.filter((b) => b.status === 'POSTED').length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 uppercase">Paid</p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {bills.filter((b) => b.status === 'PAID').length}
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
              onClick={() =>
                setFilterStatus(
                  status as 'ALL' | 'DRAFT' | 'POSTED' | 'PAID' | 'VOID'
                )
              }
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Source PO
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
                  colSpan={8}
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
                      {bill.partner?.name ? (
                        <Link
                          to={`/suppliers/${bill.partnerId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {bill.partner.name}
                        </Link>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-500">
                      {(bill as BillWithOrder).order ? (
                        <Link
                          to={`/purchase-orders/${(bill as BillWithOrder).orderId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {(bill as BillWithOrder).order?.orderNumber}
                        </Link>
                      ) : (
                        <span className="text-gray-400 italic">Manual</span>
                      )}
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
                  {/* Inline Payment Form (Reuse from Invoices) */}
                  {showPayment === bill.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={8} className="px-6 py-4">
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
                  {showHistory === bill.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={8} className="px-6 py-4">
                        <PaymentHistoryList
                          invoiceId={bill.id}
                          totalAmount={bill.amount}
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
