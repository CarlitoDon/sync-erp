import { useState, useRef, useEffect } from 'react';
import FormModal from '@/components/ui/FormModal';
import Select from '@/components/ui/Select';
import { CurrencyInput } from '@/components/ui';
import { formatCurrency, formatDate } from '@/utils/format';
import {
  PaymentMethod,
  paymentMethodOptions,
  defaultPaymentMethod,
} from '@/features/accounting/utils/financeEnums';
import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';

/* eslint-disable @sync-erp/no-hardcoded-enum */
interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  balance: number;
  dueDate: Date | string;
  /** Type for better context in UI */
  documentType?: 'bill' | 'invoice';
  /** Callback after successful payment */
  onSuccess?: () => void;
}
/* eslint-enable @sync-erp/no-hardcoded-enum */

export function RecordPaymentModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  balance,
  dueDate,
  documentType = 'invoice',
  onSuccess,
}: RecordPaymentModalProps) {
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    defaultPaymentMethod
  );
  // Stable correlationId per modal session to prevent accidental double-submit
  const correlationIdRef = useRef<string>('');
  const isSubmittingRef = useRef(false);

  // Generate new correlationId when modal opens
  useEffect(() => {
    if (isOpen) {
      correlationIdRef.current = crypto.randomUUID();
      isSubmittingRef.current = false;
    }
  }, [isOpen]);

  const utils = trpc.useUtils();

  const paymentMutation = trpc.payment.create.useMutation({
    onSuccess: () => {
      // Invalidate relevant queries
      utils.payment.list.invalidate();
      if (documentType === 'bill') {
        utils.bill.getById.invalidate();
        utils.bill.list.invalidate();
      } else {
        utils.invoice.getById.invalidate();
        utils.invoice.list.invalidate();
      }
      onSuccess?.();
    },
  });

  const handleRecordPayment = async () => {
    // Double-submit guard
    if (
      paymentAmount <= 0 ||
      paymentMutation.isPending ||
      isSubmittingRef.current
    )
      return;
    isSubmittingRef.current = true;

    await apiAction(
      () =>
        paymentMutation.mutateAsync({
          invoiceId,
          amount: paymentAmount,
          method: paymentMethod,
          businessDate: new Date(),
          correlationId: correlationIdRef.current,
        }),
      'Payment recorded!'
    );
    handleClose();
  };

  const handleClose = () => {
    setPaymentAmount(0);
    setPaymentMethod(defaultPaymentMethod);
    isSubmittingRef.current = false;
    onClose();
  };

  const maxPayment = Number(balance);

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Record Payment - ${invoiceNumber}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Info Header */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">
                {documentType === 'bill' ? 'Bill' : 'Invoice'}:
              </span>
              <span className="ml-2 font-medium">
                {invoiceNumber}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Balance Due:</span>
              <span className="ml-2 font-medium text-red-600">
                {formatCurrency(maxPayment)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Due Date:</span>
              <span className="ml-2 font-medium">
                {formatDate(dueDate)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Amount *
          </label>
          <CurrencyInput
            value={paymentAmount}
            onChange={(val) => setPaymentAmount(val)}
            max={maxPayment}
          />
          <p className="text-xs text-gray-500 mt-1">
            Max: {formatCurrency(maxPayment)}
          </p>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Method
          </label>
          <Select
            value={paymentMethod}
            onChange={(val) => setPaymentMethod(val as PaymentMethod)}
            options={paymentMethodOptions}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRecordPayment}
            disabled={
              paymentAmount <= 0 ||
              paymentAmount > maxPayment ||
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
    </FormModal>
  );
}
