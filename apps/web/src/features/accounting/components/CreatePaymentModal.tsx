/* eslint-disable @sync-erp/no-hardcoded-enum -- This file uses UI-local types (INBOUND/OUTBOUND) and query status params */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  XMarkIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import { PaymentMethodTypeSchema } from '@sync-erp/shared';
import { trpc, type RouterOutputs } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/utils/format';

type InvoiceDoc = RouterOutputs['invoice']['list'][number];
type BillDoc = RouterOutputs['bill']['list'][number];
type SelectedDoc = InvoiceDoc | BillDoc;

// Derive PaymentMethod type from the Zod schema
type PaymentMethod = z.infer<typeof PaymentMethodTypeSchema>;

type CreatePaymentForm = {
  // eslint-disable-next-line @sync-erp/no-hardcoded-enum
  type: 'INBOUND' | 'OUTBOUND';
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  date: string;
};

interface CreatePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreatePaymentModal({
  isOpen,
  onClose,
  onSuccess,
}: CreatePaymentModalProps) {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();
  const [selectedDoc, setSelectedDoc] = useState<SelectedDoc | null>(
    null
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreatePaymentForm>({
    defaultValues: {
      type: 'INBOUND',
      date: new Date().toISOString().split('T')[0],
      // Use the first option or a specific default
      method: PaymentMethodTypeSchema.options[0] as PaymentMethod,
      amount: 0,
    },
  });

  const paymentType = watch('type');

  // Fetch unpaid invoices (for Inbound) or bills (for Outbound)
  const { data: invoices = [] } = trpc.invoice.list.useQuery(
    { status: 'ISSUED' },
    { enabled: !!currentCompany?.id && paymentType === 'INBOUND' }
  );

  const { data: bills = [] } = trpc.bill.list.useQuery(
    { status: 'POSTED' },
    { enabled: !!currentCompany?.id && paymentType === 'OUTBOUND' }
  );

  const documents = paymentType === 'INBOUND' ? invoices : bills;

  const createMutation = trpc.payment.create.useMutation({
    onSuccess: async () => {
      // Invalidate payment and document lists
      utils.payment.list.invalidate();
      utils.bill.list.invalidate();
      utils.invoice.list.invalidate();
      // Order status may change after payment (e.g., DP paid)
      utils.purchaseOrder.list.invalidate();
      utils.salesOrder.list.invalidate();
      // Ensure PO list cache updates even if not mounted
      await utils.purchaseOrder.list.refetch();
      onSuccess();
      onClose();
      reset();
      setSelectedDoc(null);
    },
  });

  const onSubmit = (data: CreatePaymentForm) => {
    createMutation.mutate({
      invoiceId: data.invoiceId,
      amount: data.amount,
      method: data.method,
      reference: data.reference,
      businessDate: new Date(data.date),
    });
  };

  // When doc is selected, auto-fill amount
  const handleDocSelect = (docId: string) => {
    // We need to cast documents because union array find is tricky with differing types
    const doc = (documents as SelectedDoc[]).find(
      (d) => d.id === docId
    );

    if (doc) {
      setSelectedDoc(doc);
      // Determine balance based on doc type
      const balance = Number(doc.balance);
      setValue('amount', balance);
      setValue('invoiceId', docId);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogHeader className="flex items-center justify-between mb-0">
        <DialogTitle className="text-xl font-bold text-gray-900">
          New Payment
        </DialogTitle>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500 transition-colors"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      </DialogHeader>

      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Type Selection */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setValue('type', 'INBOUND');
                setSelectedDoc(null);
                setValue('amount', 0);
                setValue('invoiceId', '');
              }}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                paymentType === 'INBOUND'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-green-200 text-gray-600'
              }`}
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              <span className="font-medium">Receive Money</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setValue('type', 'OUTBOUND');
                setSelectedDoc(null);
                setValue('amount', 0);
                setValue('invoiceId', '');
              }}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                paymentType === 'OUTBOUND'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 hover:border-red-200 text-gray-600'
              }`}
            >
              <ArrowUpTrayIcon className="w-5 h-5" />
              <span className="font-medium">Send Money</span>
            </button>
          </div>

          {/* Document Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select{' '}
              {paymentType === 'INBOUND'
                ? 'Customer Invoice'
                : 'Vendor Bill'}
            </label>
            <select
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2 px-3 border"
              {...register('invoiceId', {
                required: 'Please select a document to pay',
              })}
              onChange={(e) => {
                register('invoiceId').onChange(e);
                handleDocSelect(e.target.value);
              }}
            >
              <option value="">-- Select Document to Pay --</option>
              {documents.map((doc) => {
                const partnerName = doc.partner?.name;
                const refNumber =
                  doc.invoiceNumber ||
                  doc.supplierInvoiceNumber ||
                  'Draft';

                return (
                  <option key={doc.id} value={doc.id}>
                    {refNumber} - {partnerName} (Due:{' '}
                    {formatCurrency(Number(doc.balance))})
                  </option>
                );
              })}
            </select>
            {errors.invoiceId && (
              <p className="mt-1 text-sm text-red-600">
                {errors.invoiceId.message}
              </p>
            )}
          </div>

          {/* Selected Document Info */}
          {selectedDoc && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">Document Total:</span>
                <span className="font-medium">
                  {formatCurrency(Number(selectedDoc.amount))}
                </span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">Already Paid:</span>
                <span className="font-medium">
                  {/* Calculate paid: amount - balance */}
                  {formatCurrency(
                    Number(selectedDoc.amount) -
                      Number(selectedDoc.balance)
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                <span className="text-gray-900 font-medium">
                  Balance Due:
                </span>
                <span className="text-primary-600 font-bold">
                  {formatCurrency(Number(selectedDoc.balance))}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Amount"
              type="number"
              selectOnFocus
              {...register('amount', {
                valueAsNumber: true,
                min: {
                  value: 0.01,
                  message: 'Amount must be greater than 0',
                },
              })}
              error={errors.amount?.message}
              min={0}
              max={
                selectedDoc ? Number(selectedDoc.balance) : undefined
              }
            />
            <Input
              label="Payment Date"
              type="date"
              {...register('date', { required: 'Date is required' })}
              error={errors.date?.message}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                {...register('method', { required: true })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2 px-3 border"
              >
                {PaymentMethodTypeSchema.options.map((method) => (
                  <option key={method} value={method}>
                    {method === 'BANK'
                      ? 'Bank Transfer'
                      : method.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Reference / Memo"
              {...register('reference')}
              placeholder="e.g. TR-12345"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending}
              disabled={!selectedDoc}
            >
              {paymentType === 'INBOUND'
                ? 'Confirm Receipt'
                : 'Confirm Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
