import { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { trpc, RouterOutputs } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { formatCurrency, formatDate } from '@/utils/format';
import { PaymentHistoryList } from '@/features/accounting/components/PaymentHistoryList';
import {
  useConfirm,
  ActionButton,
  FormModal,
  Select,
  DatePicker,
  Button,
  SummaryCards,
  StatusBadge,
  LoadingState,
} from '@/components/ui';

import {
  PaymentMethod,
  InvoiceStatusFilter,
  paymentMethodOptions,
  defaultPaymentMethod,
  invoiceStatusFilterOptions,
} from '@/features/accounting/utils/financeEnums';
import { InvoiceStatusSchema as StatusSchema } from '@/types/api';

type Bill = RouterOutputs['bill']['list'][number];
type Invoice = RouterOutputs['invoice']['list'][number];
type Document = Bill | Invoice;

/* eslint-disable @sync-erp/no-hardcoded-enum */
type DocumentType = 'bill' | 'invoice';
/* eslint-enable @sync-erp/no-hardcoded-enum */

export interface DocumentListProps {
  type: DocumentType;
  filter?: {
    partnerId?: string;
    orderId?: string;
  };
}

/**
 * Generic document list component for Bills and Invoices.
 * Consolidates ~90% duplicate code between BillList and InvoiceList.
 */
export function DocumentList({
  type,
  filter: _filter,
}: DocumentListProps) {
  const confirm = useConfirm();
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  const isBill = type === 'bill';
  const entityLabel = isBill ? 'Bill' : 'Invoice';
  const partnerLabel = isBill ? 'Supplier' : 'Customer';
  const partnerRoute = isBill ? 'suppliers' : 'customers';
  const detailRoute = isBill ? 'bills' : 'invoices';

  // Query based on type
  const billQuery = trpc.bill.list.useQuery(
    { status: undefined },
    { enabled: !!currentCompany?.id && isBill }
  );
  const invoiceQuery = trpc.invoice.list.useQuery(
    { status: undefined },
    { enabled: !!currentCompany?.id && !isBill }
  );

  const documents =
    (isBill ? billQuery.data : invoiceQuery.data) || [];
  const loading = isBill
    ? billQuery.isLoading
    : invoiceQuery.isLoading;

  // Mutations
  const postBillMutation = trpc.bill.post.useMutation({
    onSuccess: () => utils.bill.list.invalidate(),
  });
  const postInvoiceMutation = trpc.invoice.post.useMutation({
    onSuccess: () => utils.invoice.list.invalidate(),
  });
  const voidBillMutation = trpc.bill.void.useMutation({
    onSuccess: () => utils.bill.list.invalidate(),
  });
  const voidInvoiceMutation = trpc.invoice.void.useMutation({
    onSuccess: () => utils.invoice.list.invalidate(),
  });
  const paymentMutation = trpc.payment.create.useMutation({
    onSuccess: () => {
      utils.bill.list.invalidate();
      utils.invoice.list.invalidate();
      utils.payment.list.invalidate();
    },
  });

  const [filterStatus, setFilterStatus] =
    useState<InvoiceStatusFilter>('ALL');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(
    null
  );
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    defaultPaymentMethod
  );
  const [businessDate, setBusinessDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [showHistory, setShowHistory] = useState<string | null>(null);

  const handlePost = async (id: string) => {
    await apiAction(
      () =>
        isBill
          ? postBillMutation.mutateAsync({ id })
          : postInvoiceMutation.mutateAsync({ id }),
      `${entityLabel} posted!`
    );
  };

  const handleVoid = async (id: string) => {
    const confirmed = await confirm({
      title: `Void ${entityLabel}`,
      message: `Are you sure you want to void this ${entityLabel.toLowerCase()}?`,
      confirmText: 'Yes, Void',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () =>
        isBill
          ? voidBillMutation.mutateAsync({ id })
          : voidInvoiceMutation.mutateAsync({ id }),
      `${entityLabel} voided`
    );
  };

  const openPaymentModal = (doc: Document) => {
    setSelectedDoc(doc);
    setPaymentAmount(Number(doc.balance));
    setPaymentMethod(defaultPaymentMethod);
    setBusinessDate(new Date().toISOString().split('T')[0]);
  };

  const closePaymentModal = () => {
    setSelectedDoc(null);
    setPaymentAmount(0);
  };

  const handlePayment = async () => {
    if (
      !selectedDoc ||
      paymentAmount <= 0 ||
      paymentMutation.isPending
    )
      return;
    const result = await apiAction(
      () =>
        paymentMutation.mutateAsync({
          invoiceId: selectedDoc.id,
          amount: paymentAmount,
          method: paymentMethod,
          businessDate: new Date(businessDate),
          correlationId: crypto.randomUUID(),
        }),
      'Payment recorded!'
    );
    if (result) closePaymentModal();
  };

  if (loading && documents.length === 0) {
    return <LoadingState />;
  }

  const filteredDocs = documents.filter(
    (d) => filterStatus === 'ALL' || d.status === filterStatus
  );

  const outstandingAmount = documents
    .filter((d) => d.status === StatusSchema.enum.POSTED)
    .reduce((sum, d) => sum + Number(d.balance), 0);

  return (
    <div className="space-y-6">
      {/* Payment Modal */}
      <FormModal
        isOpen={selectedDoc !== null}
        onClose={closePaymentModal}
        title="Record Payment"
        maxWidth="md"
      >
        {selectedDoc && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">
                  {entityLabel} Number
                </span>
                <span className="font-mono font-medium">
                  {selectedDoc.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">
                  {partnerLabel}
                </span>
                <span className="font-medium">
                  {selectedDoc.partner?.name || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">
                  Total Amount
                </span>
                <span className="font-medium">
                  {formatCurrency(Number(selectedDoc.amount))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">
                  Outstanding Balance
                </span>
                <span className="font-bold text-red-600">
                  {formatCurrency(Number(selectedDoc.balance))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">
                  Due Date
                </span>
                <span
                  className={
                    new Date(selectedDoc.dueDate) < new Date()
                      ? 'text-red-600 font-bold'
                      : ''
                  }
                >
                  {formatDate(selectedDoc.dueDate)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Amount *
              </label>
              <input
                type="number"
                min={0}
                max={Number(selectedDoc.balance)}
                step={0.01}
                value={paymentAmount}
                onChange={(e) =>
                  setPaymentAmount(parseFloat(e.target.value) || 0)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Max: {formatCurrency(Number(selectedDoc.balance))}
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

            {!isBill && (
              <DatePicker
                label="Business Date *"
                value={businessDate}
                onChange={setBusinessDate}
              />
            )}

            <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={closePaymentModal}
                disabled={paymentMutation.isPending}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <Button
                variant="primary"
                onClick={handlePayment}
                isLoading={paymentMutation.isPending}
                disabled={
                  paymentAmount <= 0 ||
                  paymentAmount > Number(selectedDoc.balance)
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
      <SummaryCards
        cards={[
          {
            label: `Total ${entityLabel}s`,
            value: documents.length,
          },
          {
            label: isBill ? 'Unpaid Bills' : 'Outstanding',
            value: documents.filter(
              (d) => d.status === StatusSchema.enum.POSTED
            ).length,
            color: 'blue',
          },
          {
            label: 'Paid',
            value: documents.filter(
              (d) => d.status === StatusSchema.enum.PAID
            ).length,
            color: 'green',
          },
          {
            label: 'Outstanding Amount',
            value: outstandingAmount,
            isCurrency: true,
            color: isBill ? 'red' : 'primary',
          },
        ]}
      />

      {/* Status Filter Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {invoiceStatusFilterOptions
            .filter((o) => (isBill ? o.value !== 'VOID' : true))
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
                {opt.value === 'ALL'
                  ? `All ${entityLabel}s`
                  : opt.label}
              </button>
            ))}
        </nav>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {entityLabel} #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {partnerLabel}
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
              {filteredDocs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No {entityLabel.toLowerCase()}s found.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <Fragment key={doc.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-mono text-sm">
                        <Link
                          to={`/${detailRoute}/${doc.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {doc.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/${partnerRoute}/${doc.partnerId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {doc.partner?.name || '-'}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {formatCurrency(Number(doc.amount))}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold">
                        {formatCurrency(Number(doc.balance))}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={
                            new Date(doc.dueDate) < new Date() &&
                            doc.status === StatusSchema.enum.POSTED
                              ? 'text-red-600 font-bold'
                              : ''
                          }
                        >
                          {formatDate(doc.dueDate)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge
                          status={doc.status}
                          domain="invoice"
                        />
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {doc.status === StatusSchema.enum.DRAFT && (
                          <>
                            <ActionButton
                              variant="primary"
                              onClick={() => handlePost(doc.id)}
                            >
                              Post
                            </ActionButton>
                            <ActionButton
                              variant="danger"
                              onClick={() => handleVoid(doc.id)}
                            >
                              Void
                            </ActionButton>
                          </>
                        )}
                        {doc.status === StatusSchema.enum.POSTED && (
                          <ActionButton
                            variant="success"
                            onClick={() => openPaymentModal(doc)}
                          >
                            Record Payment
                          </ActionButton>
                        )}
                        <ActionButton
                          variant="secondary"
                          onClick={() =>
                            setShowHistory(
                              showHistory === doc.id ? null : doc.id
                            )
                          }
                        >
                          {showHistory === doc.id
                            ? 'Hide History'
                            : 'History'}
                        </ActionButton>
                      </td>
                    </tr>
                    {showHistory === doc.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-6 py-4">
                          <PaymentHistoryList
                            invoiceId={doc.id}
                            totalAmount={Number(doc.amount)}
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
    </div>
  );
}
