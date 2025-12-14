import { useState, useEffect, useMemo } from 'react';
import {
  billService,
  Bill,
  CreateManualBillInput,
} from '../services/billService';
import {
  paymentService,
  CreatePaymentInput,
} from '../services/invoiceService';
import {
  partnerService,
  Partner,
} from '../../partners/services/partnerService';
import { useCompany } from '../../../contexts/CompanyContext';
import { useCompanyData } from '../../../hooks/useCompanyData';
import { apiAction } from '../../../hooks/useApiAction';
import { useConfirm } from '../../../components/ui/ConfirmModal';
import ActionButton from '../../../components/ui/ActionButton';
import FormModal from '../../../components/ui/FormModal';
import { formatCurrency, formatDate } from '../../../utils/format';
import { PaymentHistoryList } from '../components/PaymentHistoryList';

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
  const [showHistory, setShowHistory] = useState<string | null>(null);

  // Create Bill Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [suppliers, setSuppliers] = useState<Partner[]>([]);
  const [formData, setFormData] = useState<CreateManualBillInput>({
    partnerId: '',
    subtotal: 0,
    taxRate: 0,
    dueDate: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Load suppliers when modal opens
  useEffect(() => {
    if (showCreateModal && currentCompany) {
      partnerService.listSuppliers().then(setSuppliers).catch(console.error);
    }
  }, [showCreateModal, currentCompany]);

  // Tax calculation
  const taxAmount = useMemo(() => {
    const rate = formData.taxRate || 0;
    const multiplier = rate > 1 ? rate / 100 : rate;
    return formData.subtotal * multiplier;
  }, [formData.subtotal, formData.taxRate]);

  const totalAmount = useMemo(
    () => formData.subtotal + taxAmount,
    [formData.subtotal, taxAmount]
  );

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

  // Create Bill validation and submit
  const validateCreateForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    if (!formData.partnerId) {
      errors.partnerId = 'Supplier is required';
    }
    if (!formData.subtotal || formData.subtotal <= 0) {
      errors.subtotal = 'Amount must be greater than 0';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateBill = async () => {
    if (!validateCreateForm()) return;

    const result = await apiAction(
      () => billService.createManual(formData),
      'Bill created!'
    );
    if (result) {
      setShowCreateModal(false);
      setFormData({
        partnerId: '',
        subtotal: 0,
        taxRate: 0,
        dueDate: '',
        notes: '',
      });
      setFormErrors({});
      loadBills();
    }
  };

  const resetCreateForm = () => {
    setShowCreateModal(false);
    setFormData({
      partnerId: '',
      subtotal: 0,
      taxRate: 0,
      dueDate: '',
      notes: '',
    });
    setFormErrors({});
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
    <>
      {/* Create Bill Modal */}
      <FormModal
        isOpen={showCreateModal}
        onClose={resetCreateForm}
        title="Create Manual Bill"
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* Supplier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier *
            </label>
            <select
              value={formData.partnerId}
              onChange={(e) =>
                setFormData({ ...formData, partnerId: e.target.value })
              }
              className={`w-full px-3 py-2 border rounded-lg ${
                formErrors.partnerId
                  ? 'border-red-500'
                  : 'border-gray-300'
              }`}
            >
              <option value="">Select Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {formErrors.partnerId && (
              <p className="text-red-500 text-sm mt-1">
                {formErrors.partnerId}
              </p>
            )}
          </div>

          {/* Subtotal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subtotal Amount *
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={formData.subtotal || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  subtotal: parseFloat(e.target.value) || 0,
                })
              }
              className={`w-full px-3 py-2 border rounded-lg ${
                formErrors.subtotal
                  ? 'border-red-500'
                  : 'border-gray-300'
              }`}
              placeholder="0.00"
            />
            {formErrors.subtotal && (
              <p className="text-red-500 text-sm mt-1">
                {formErrors.subtotal}
              </p>
            )}
          </div>

          {/* Tax Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax Rate (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={formData.taxRate || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  taxRate: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="0"
            />
          </div>

          {/* Calculated Amounts */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax Amount:</span>
              <span className="font-medium">
                {formatCurrency(taxAmount)}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold mt-2">
              <span>Total:</span>
              <span className="text-blue-600">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={formData.dueDate || ''}
              onChange={(e) =>
                setFormData({ ...formData, dueDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave blank for default 30 days
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Optional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={resetCreateForm}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateBill}
              disabled={!formData.partnerId || formData.subtotal <= 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Create Bill
            </button>
          </div>
        </div>
      </FormModal>

      {/* Main Content */}
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
        <ActionButton
          variant="primary"
          onClick={() => setShowCreateModal(true)}
        >
          + Create Bill
        </ActionButton>
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
                  {showHistory === bill.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-4">
                        <PaymentHistoryList
                          invoiceId={bill.id}
                          totalAmount={bill.amount}
                        />
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
    </>
  );
}
