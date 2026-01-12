import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import FormModal from '@/components/ui/FormModal';
import { Input } from '@/components/ui';
import { apiAction } from '@/hooks/useApiAction';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  itemId: string | null;
  itemSku?: string;
  availableStock?: number;
  onSuccess?: () => void;
}

export default function ConvertStockModal({
  isOpen,
  onClose,
  itemId,
  itemSku,
  availableStock = 0,
  onSuccess,
}: Props) {
  const utils = trpc.useUtils();

  const convertMutation = trpc.rental.items.convertStock.useMutation({
    onSuccess: () => {
      utils.rental.items.list.invalidate();
      utils.product.list.invalidate();
      onSuccess?.();
      handleClose();
    },
  });

  const [form, setForm] = useState({
    prefix: itemSku ? `${itemSku}-RENT` : 'RENT',
    quantity: Math.min(10, availableStock),
    startNumber: 1,
  });

  const resetForm = () => {
    setForm({
      prefix: itemSku ? `${itemSku}-RENT` : 'RENT',
      quantity: Math.min(10, availableStock),
      startNumber: 1,
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId) return;

    await apiAction(
      () =>
        convertMutation.mutateAsync({
          rentalItemId: itemId,
          quantity: Number(form.quantity),
          prefix: form.prefix,
          startNumber: Number(form.startNumber),
        }),
      `Berhasil mengkonversi ${form.quantity} unit dari stok`
    );
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Konversi Stok ke Unit Rental"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
          <p>
            Stok tersedia: <strong>{availableStock} unit</strong>
          </p>
          <p className="text-xs mt-1">
            Konversi akan mengurangi stok produk dan membuat unit
            rental baru
          </p>
        </div>

        <Input
          label="Prefix Kode *"
          value={form.prefix}
          onChange={(e) =>
            setForm({ ...form, prefix: e.target.value })
          }
          placeholder="e.g., KSR-RENT"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Nomor Awal"
            type="number"
            min={1}
            value={String(form.startNumber)}
            onChange={(e) =>
              setForm({
                ...form,
                startNumber: Number(e.target.value),
              })
            }
          />
          <Input
            label="Jumlah Konversi"
            type="number"
            min={1}
            max={availableStock}
            value={String(form.quantity)}
            onChange={(e) =>
              setForm({ ...form, quantity: Number(e.target.value) })
            }
          />
        </div>

        <p className="text-xs text-gray-500">
          Akan membuat: {form.prefix}-
          {String(form.startNumber).padStart(3, '0')} sampai{' '}
          {form.prefix}-
          {String(form.startNumber + form.quantity - 1).padStart(
            3,
            '0'
          )}
        </p>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={convertMutation.isPending || form.quantity < 1}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {convertMutation.isPending
              ? 'Mengkonversi...'
              : `Konversi ${form.quantity} Unit`}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
