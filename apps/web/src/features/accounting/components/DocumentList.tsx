import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useDocumentList } from '@/features/accounting/hooks/useDocumentList';
import { formatCurrency, formatDate } from '@/utils/format';
import { PaymentHistoryList } from '@/features/accounting/components/PaymentHistoryList';
import {
  ActionButton,
  FormModal,
  Select,
  StatusBadge,
  LoadingState,
  DatePicker,
  Button,
  SummaryCards,
} from '@/components/ui';

import {
  PaymentMethodType,
  DocumentType,
  InvoiceStatusFilter,
  invoiceStatusOptions,
} from '@/features/accounting/utils/financeEnums';
import {
  PAYMENT_METHOD_OPTIONS,
  INVOICE_STATUS_OPTIONS,
} from '@sync-erp/shared';
import { InvoiceStatusSchema as StatusSchema } from '@/types/api';
import { CurrencyInput } from '@/components/ui/CurrencyInput';

const invoiceStatusTabLabels = new Map<string, string>(
  invoiceStatusOptions.map((option) => [option.value, option.label])
);

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
  /* Filters, Mutations, and State Logic moved to useDocumentList */
  filter: _filter,
}: DocumentListProps) {
  const {
    isBill,
    entityLabel,
    documents,
    filteredDocs,
    outstandingAmount,
    loading,
    filterStatus,
    setFilterStatus,
    selectedDoc,
    paymentAmount,
    setPaymentAmount,
    paymentMethod,
    setPaymentMethod,
    businessDate,
    setBusinessDate,
    showHistory,
    setShowHistory,
    handlePost,
    handleVoid,
    handleDelete,
    openPaymentModal,
    closePaymentModal,
    handlePayment,
    paymentMutation,
  } = useDocumentList(type);

  const partnerLabel = isBill ? 'Supplier' : 'Customer';
  const partnerRoute = isBill ? 'suppliers' : 'customers';
  const detailRoute = isBill ? 'bills' : 'invoices';

  if (loading && documents.length === 0) {
    return <LoadingState />;
  }

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
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">
                  {entityLabel} Number
                </span>
                <span className="font-mono font-medium">
                  {selectedDoc.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">
                  {partnerLabel}
                </span>
                <span className="font-medium">
                  {selectedDoc.partner?.name || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">
                  Total Amount
                </span>
                <span className="font-medium">
                  {formatCurrency(Number(selectedDoc.amount))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">
                  Outstanding Balance
                </span>
                <span className="font-bold text-red-600">
                  {formatCurrency(Number(selectedDoc.balance))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">
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
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Payment Amount *
              </label>
              <CurrencyInput
                min={0}
                max={Number(selectedDoc.balance)}
                value={paymentAmount}
                onChange={(val) => setPaymentAmount(val)}
              />
              <p className="mt-1 text-xs text-slate-500">
                Max: {formatCurrency(Number(selectedDoc.balance))}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Payment Method
              </label>
              <Select
                value={paymentMethod}
                onChange={(val) =>
                  setPaymentMethod(val as PaymentMethodType)
                }
                options={PAYMENT_METHOD_OPTIONS}
              />
            </div>

            {!isBill && (
              <DatePicker
                label="Business Date *"
                value={businessDate}
                onChange={setBusinessDate}
              />
            )}

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={closePaymentModal}
                disabled={paymentMutation.isPending}
                className="rounded-md bg-slate-100 px-4 py-2 text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
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
                className="bg-emerald-600 hover:bg-emerald-700"
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
      <div className="overflow-x-auto border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <nav className="-mb-px flex space-x-8">
          {INVOICE_STATUS_OPTIONS
            // eslint-disable-next-line @sync-erp/no-hardcoded-enum -- 'VOID' is a UI filter comparison
            .filter((o) => (isBill ? o.value !== 'VOID' : true))
            .map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  setFilterStatus(opt.value as InvoiceStatusFilter)
                }
                className={`${
                  filterStatus === opt.value
                    ? 'border-cyan-600 text-cyan-700'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                } whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium`}
              >
                {/* eslint-disable-next-line @sync-erp/no-hardcoded-enum -- 'ALL' is a UI filter display label */}
                {opt.value === 'ALL'
                  ? `All ${entityLabel}s`
                  : (invoiceStatusTabLabels.get(opt.value) ?? opt.label)}
              </button>
            ))}
        </nav>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  {entityLabel} #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  {partnerLabel}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Balance
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
                  Due Date
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    No {entityLabel.toLowerCase()}s found.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <Fragment key={doc.id}>
                    <tr className="hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-mono text-sm">
                        <Link
                          to={`/${detailRoute}/${doc.id}`}
                          className="text-cyan-700 hover:text-cyan-900 hover:underline"
                        >
                          {doc.invoiceNumber}
                        </Link>
                        {/* Feature: DP Badge */}
                        {'isDownPayment' in doc &&
                          doc.isDownPayment && (
                            <span className="ml-2 inline-flex items-center rounded border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-800">
                              DP
                            </span>
                          )}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/${partnerRoute}/${doc.partnerId}`}
                          className="text-cyan-700 hover:text-cyan-900 hover:underline"
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
                            {isBill ? (
                              <ActionButton
                                variant="danger"
                                onClick={() => handleDelete(doc.id)}
                              >
                                Delete
                              </ActionButton>
                            ) : (
                              <ActionButton
                                variant="danger"
                                onClick={() => handleVoid(doc.id)}
                              >
                                Void
                              </ActionButton>
                            )}
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
                      <tr className="bg-slate-50">
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
