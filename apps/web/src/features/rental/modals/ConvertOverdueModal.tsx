import React, { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import FormModal from '@/components/ui/FormModal';
import { apiAction } from '@/hooks/useApiAction';
import type { PortableRentalOrder } from '@sync-erp/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: PortableRentalOrder | null;
  onSuccess: () => void;
}

/**
 * T034: Konversi overdue menjadi sewa harian + template WhatsApp (FR-010).
 */
export default function ConvertOverdueModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: Props) {
  const utils = trpc.useUtils();
  const [additionalDays, setAdditionalDays] = useState(1);
  const [waMessage, setWaMessage] = useState<string | null>(null);
  const [resultDays, setResultDays] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setAdditionalDays(1);
      setWaMessage(null);
      setResultDays(0);
    }
  }, [isOpen]);

  const convertMutation = trpc.rental.orders.convertOverdue.useMutation({
    onSuccess: (data) => {
      utils.rental.orders.list.invalidate();
      if (order) {
        utils.rental.orders.getById.invalidate({ id: order.id });
      }
      setWaMessage(data.waMessageTemplate);
      setResultDays(data.overdueDays);
      onSuccess();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    await apiAction(
      () =>
        convertMutation.mutateAsync({
          orderId: order.id,
          additionalDays,
          reason: `Konversi keterlambatan ${additionalDays} hari ke sewa harian`,
        }),
      'Overdue dikonversi menjadi sewa harian'
    );
  };

  const handleCopy = async () => {
    if (!waMessage) return;
    try {
      await navigator.clipboard.writeText(waMessage);
    } catch {
      // clipboard unavailable - user can copy manually
    }
  };

  if (!order) return null;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Konversi Sewa Harian - ${order.orderNumber}`}
    >
      {!waMessage ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-600">
            Keterlambatan penjemputan dikonversi menjadi perpanjangan
            sewa harian dengan tarif proporsional (tanpa denda kaku).
            Extension record + jurnal tagihan dibuat otomatis.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tambahan hari *
            </label>
            <input
              type="number"
              min={1}
              value={additionalDays}
              onChange={(e) =>
                setAdditionalDays(Math.max(1, Number(e.target.value) || 1))
              }
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={convertMutation.isPending}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
            >
              {convertMutation.isPending
                ? 'Memproses...'
                : 'Konversi Sewa Harian'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-sm text-green-800">
            Perpanjangan {resultDays} hari berhasil dicatat.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template WhatsApp siap kirim
            </label>
            <textarea
              value={waMessage}
              readOnly
              rows={8}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Salin Pesan
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </FormModal>
  );
}
