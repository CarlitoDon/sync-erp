import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/utils/format';
import {
  paymentMethodOptions,
  defaultPaymentMethod,
} from '@/features/accounting/utils/financeEnums';
import { PaymentMethodType } from '@sync-erp/shared';
import { CurrencyInput } from '@/components/ui';

interface RegisterDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  maxAmount: number;
  onSuccess: () => void;
}

export function RegisterDepositModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  maxAmount,
  onSuccess,
}: RegisterDepositModalProps) {
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<PaymentMethodType>(
    defaultPaymentMethod
  );
  const [reference, setReference] = useState('');

  const registerDeposit =
    trpc.customerDeposit.registerDeposit.useMutation({
      onSuccess: () => {
        onSuccess();
        onClose();
        setAmount(0);
        setReference('');
      },
    });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || amount > maxAmount) {
      toast.error(
        `Jumlah harus antara 1 dan ${formatCurrency(maxAmount)}`
      );
      return;
    }

    registerDeposit.mutate({
      orderId,
      amount: amount,
      method,
      reference: reference || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Register Customer Deposit
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Recording deposit for order <strong>{orderNumber}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deposit Amount
            </label>
            <CurrencyInput
              value={amount}
              onChange={(val) => setAmount(val)}
              max={maxAmount}
              min={1}
              placeholder={`Max: ${formatCurrency(maxAmount)}`}
            />
            <p className="text-xs text-gray-500 mt-1">
              Maximum: {formatCurrency(maxAmount)}
            </p>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>
            <select
              value={method}
              onChange={(e) =>
                setMethod(e.target.value as PaymentMethodType)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {paymentMethodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference (Optional)
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Bank Transfer #123"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={registerDeposit.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {registerDeposit.isPending
                ? 'Processing...'
                : 'Record Deposit'}
            </button>
          </div>
        </form>

        {registerDeposit.error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {registerDeposit.error.message}
          </div>
        )}
      </div>
    </div>
  );
}
