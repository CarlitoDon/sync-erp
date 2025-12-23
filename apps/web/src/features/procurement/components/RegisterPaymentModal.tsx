import { useState } from 'react';
import FormModal from '@/components/ui/FormModal';
import Select from '@/components/ui/Select';
import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';
import { formatCurrency } from '@/utils/format';
import {
  PaymentMethodSchema,
  PaymentMethodType,
} from '@sync-erp/shared';

interface RegisterPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  paidAmount: number;
  onSuccess?: () => void;
}

export function RegisterPaymentModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  totalAmount,
  paidAmount,
  onSuccess,
}: RegisterPaymentModalProps) {
  const remainingAmount = totalAmount - paidAmount;
  const utils = trpc.useUtils();

  const registerMutation =
    trpc.upfrontPayment.registerPayment.useMutation({
      onSuccess: () => {
        utils.upfrontPayment.getPaymentSummary.invalidate({
          orderId,
        });
        utils.purchaseOrder.getById.invalidate({ id: orderId });
        onSuccess?.();
      },
    });

  const [formData, setFormData] = useState({
    amount: remainingAmount,
    method: PaymentMethodSchema.enum
      .BANK_TRANSFER as PaymentMethodType,
    reference: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount <= 0 || formData.amount > remainingAmount)
      return;

    await apiAction(
      () =>
        registerMutation.mutateAsync({
          orderId,
          amount: formData.amount,
          method: formData.method,
          reference: formData.reference || undefined,
        }),
      'Payment registered successfully!'
    );

    handleClose();
  };

  const handleClose = () => {
    setFormData({
      amount: remainingAmount,
      method: PaymentMethodSchema.enum.BANK_TRANSFER,
      reference: '',
    });
    onClose();
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Record Upfront Payment - ${orderNumber}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Payment Summary */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">PO Total:</span>
            <span className="font-medium">
              {formatCurrency(totalAmount)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Already Paid:</span>
            <span className="font-medium text-green-600">
              {formatCurrency(paidAmount)}
            </span>
          </div>
          <div className="flex justify-between text-sm border-t pt-2">
            <span className="text-gray-600">Remaining:</span>
            <span className="font-bold text-primary-600">
              {formatCurrency(remainingAmount)}
            </span>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Amount *
          </label>
          <input
            type="number"
            required
            min={1}
            max={remainingAmount}
            value={formData.amount}
            onChange={(e) =>
              setFormData({
                ...formData,
                amount: parseFloat(e.target.value) || 0,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          />
          {formData.amount > remainingAmount && (
            <p className="text-sm text-red-500 mt-1">
              Amount exceeds remaining balance
            </p>
          )}
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Method *
          </label>
          <Select
            value={formData.method}
            onChange={(val) =>
              setFormData({
                ...formData,
                method: val as PaymentMethodType,
              })
            }
            options={[
              {
                value: PaymentMethodSchema.enum.BANK_TRANSFER,
                label: 'Bank Transfer',
              },
              { value: PaymentMethodSchema.enum.CASH, label: 'Cash' },
              {
                value: PaymentMethodSchema.enum.CHECK,
                label: 'Check',
              },
            ]}
          />
        </div>

        {/* Reference */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reference (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g., Transfer #12345"
            value={formData.reference}
            onChange={(e) =>
              setFormData({ ...formData, reference: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              formData.amount <= 0 ||
              formData.amount > remainingAmount ||
              registerMutation.isPending
            }
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {registerMutation.isPending
              ? 'Processing...'
              : 'Record Payment'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
