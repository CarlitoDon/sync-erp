import React, { useState } from 'react';
import FormModal from '@/components/ui/FormModal';
import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';
import { formatCurrency, formatDateTime } from '@/utils/format';
import type { RentalOrderWithRelations } from '@sync-erp/shared';
import {
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: RentalOrderWithRelations | null;
  onSuccess?: () => void;
}

export default function VerifyPaymentModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: Props) {
  const utils = trpc.useUtils();
  const [action, setAction] = useState<'confirm' | 'reject' | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [failReason, setFailReason] = useState('');

  const verifyMutation = trpc.rental.orders.verifyPayment.useMutation({
    onSuccess: () => {
      utils.rental.orders.list.invalidate();
      if (order) {
        utils.rental.orders.getById.invalidate({ id: order.id });
      }
      onSuccess?.();
      handleClose();
    },
  });

  const handleClose = () => {
    setAction(null);
    setPaymentReference('');
    setFailReason('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !action) return;

    await apiAction(
      () =>
        verifyMutation.mutateAsync({
          orderId: order.id,
          action,
          paymentReference: action === 'confirm' ? paymentReference : undefined,
          failReason: action === 'reject' ? failReason : undefined,
        }),
      action === 'confirm' ? 'Pembayaran dikonfirmasi' : 'Pembayaran ditolak'
    );
  };

  if (!order) return null;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Verifikasi Pembayaran"
    >
      <div className="space-y-4">
        {/* Order Summary */}
        <div className="p-4 bg-gray-50 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Order</span>
            <span className="font-medium">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Customer</span>
            <span className="font-medium">{order.partner?.name || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Total</span>
            <span className="font-bold text-lg">
              {formatCurrency(Number(order.totalAmount))}
            </span>
          </div>
          {order.paymentClaimedAt && (
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-500">Diklaim pada</span>
              <span className="text-sm">
                {formatDateTime(order.paymentClaimedAt)}
              </span>
            </div>
          )}
        </div>

        {/* Action Selection */}
        {action === null && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAction('confirm')}
              className="flex flex-col items-center gap-2 p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 hover:border-green-400 transition-colors"
            >
              <CheckCircleIcon className="w-8 h-8 text-green-600" />
              <span className="font-medium text-green-700">Konfirmasi</span>
              <span className="text-xs text-gray-500 text-center">
                Pembayaran sudah diterima
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAction('reject')}
              className="flex flex-col items-center gap-2 p-4 border-2 border-red-200 rounded-lg hover:bg-red-50 hover:border-red-400 transition-colors"
            >
              <XCircleIcon className="w-8 h-8 text-red-600" />
              <span className="font-medium text-red-700">Tolak</span>
              <span className="text-xs text-gray-500 text-center">
                Pembayaran tidak valid
              </span>
            </button>
          </div>
        )}

        {/* Confirm Form */}
        {action === 'confirm' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✅ Anda akan mengkonfirmasi bahwa pembayaran telah diterima.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referensi Pembayaran (opsional)
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Contoh: No. Rekening, ID Transaksi..."
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Nomor transaksi/rekening pengirim untuk referensi
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setAction(null)}
                className="px-4 py-2 bg-gray-100 rounded-lg"
              >
                Kembali
              </button>
              <button
                type="submit"
                disabled={verifyMutation.isPending}
                className="px-6 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50 hover:bg-green-700"
              >
                {verifyMutation.isPending ? 'Memproses...' : 'Konfirmasi Pembayaran'}
              </button>
            </div>
          </form>
        )}

        {/* Reject Form */}
        {action === 'reject' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                ⚠️ Pembayaran akan ditandai sebagai GAGAL. Customer dapat mengulang pembayaran.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alasan Penolakan *
              </label>
              <textarea
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                placeholder="Contoh: Transfer tidak ditemukan, nominal tidak sesuai..."
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setAction(null)}
                className="px-4 py-2 bg-gray-100 rounded-lg"
              >
                Kembali
              </button>
              <button
                type="submit"
                disabled={verifyMutation.isPending || !failReason.trim()}
                className="px-6 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50 hover:bg-red-700"
              >
                {verifyMutation.isPending ? 'Memproses...' : 'Tolak Pembayaran'}
              </button>
            </div>
          </form>
        )}

        {/* Cancel button when no action selected */}
        {action === null && (
          <div className="flex justify-end pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-gray-100 rounded-lg"
            >
              Tutup
            </button>
          </div>
        )}
      </div>
    </FormModal>
  );
}
