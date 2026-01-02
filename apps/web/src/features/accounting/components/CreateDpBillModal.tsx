import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { formatCurrency } from '@/utils/format';
import { FormModal } from '@/components/ui';

interface CreateDpBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber?: string;
  defaultDpAmount: number;
  dpPercent: number;
  orderTotal: number;
  onSuccess?: (billId: string) => void;
}

export default function CreateDpBillModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  defaultDpAmount,
  dpPercent,
  orderTotal,
  onSuccess,
}: CreateDpBillModalProps) {
  const [amount, setAmount] = useState<number>(defaultDpAmount);
  const [percent, setPercent] = useState<number>(dpPercent);
  const [error, setError] = useState<string | null>(null);

  // Reset values when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount(defaultDpAmount);
      setPercent(dpPercent);
      setError(null);
    }
  }, [isOpen, defaultDpAmount, dpPercent]);

  const createDpBillMutation = trpc.bill.createDpBill.useMutation({
    onSuccess: (bill) => {
      onClose();
      onSuccess?.(bill.id);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handlePercentChange = (newPercent: number) => {
    setPercent(newPercent);
    const newAmount = Math.round((newPercent / 100) * orderTotal);
    setAmount(newAmount);
  };

  const handleAmountChange = (newAmount: number) => {
    setAmount(newAmount);
    const newPercent = orderTotal > 0 ? (newAmount / orderTotal) * 100 : 0;
    setPercent(Math.round(newPercent * 10) / 10); // Round to 1 decimal
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (amount <= 0) {
      setError('DP amount must be greater than 0');
      return;
    }

    if (amount > orderTotal) {
      setError('DP amount cannot exceed order total');
      return;
    }

    createDpBillMutation.mutate({ orderId, amount });
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Down Payment Bill"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Order Info */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">PO Number:</span>
            <span className="font-mono font-medium">{orderNumber || orderId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Order Total:</span>
            <span className="font-medium">{formatCurrency(orderTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Default DP:</span>
            <span className="font-medium">{dpPercent}% = {formatCurrency(defaultDpAmount)}</span>
          </div>
        </div>

        {/* Two Column Input */}
        <div className="grid grid-cols-2 gap-4">
          {/* Percentage Input */}
          <div>
            <label
              htmlFor="dpPercent"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              DP Percentage
            </label>
            <div className="relative">
              <input
                type="number"
                id="dpPercent"
                value={percent}
                onChange={(e) => handlePercentChange(Number(e.target.value))}
                className="w-full pr-8 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={0}
                max={100}
                step={0.1}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                %
              </span>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label
              htmlFor="dpAmount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              DP Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                Rp
              </span>
              <input
                type="number"
                id="dpAmount"
                value={amount}
                onChange={(e) => handleAmountChange(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={0}
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-blue-700 font-medium">DP Bill Amount:</span>
            <span className="text-blue-900 font-bold text-lg">{formatCurrency(amount)}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-blue-600 mt-1">
            <span>Remaining after DP:</span>
            <span>{formatCurrency(orderTotal - amount)}</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createDpBillMutation.isPending}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {createDpBillMutation.isPending ? 'Creating...' : 'Create DP Bill'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
