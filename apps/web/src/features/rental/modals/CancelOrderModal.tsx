import React, { useState } from 'react';
import FormModal from '@/components/ui/FormModal';
import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  onSuccess?: () => void;
}

export default function CancelOrderModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  onSuccess,
}: Props) {
  const utils = trpc.useUtils();
  const [reason, setReason] = useState('');

  const cancelMutation = trpc.rental.orders.cancel.useMutation({
    onSuccess: () => {
      utils.rental.orders.list.invalidate();
      utils.rental.orders.getById.invalidate({ id: orderId });
      onSuccess?.();
      handleClose();
    },
  });

  const handleClose = () => {
    setReason('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    await apiAction(
      () => cancelMutation.mutateAsync({ orderId, reason }),
      'Order dibatalkan'
    );
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Batalkan Order ${orderNumber}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            Order yang dibatalkan tidak dapat dikembalikan. Pastikan
            Anda yakin sebelum melanjutkan.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alasan Pembatalan *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: Customer membatalkan order..."
            className="w-full px-3 py-2 border rounded-lg"
            rows={3}
            required
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-gray-100 rounded-lg"
          >
            Kembali
          </button>
          <button
            type="submit"
            disabled={cancelMutation.isPending || !reason.trim()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50 hover:bg-red-700"
          >
            {cancelMutation.isPending
              ? 'Memproses...'
              : 'Batalkan Order'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
