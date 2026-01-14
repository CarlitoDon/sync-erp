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

  const [quantity, setQuantity] = useState(
    Math.min(10, availableStock)
  );

  const resetForm = () => {
    setQuantity(Math.min(10, availableStock));
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
          quantity: Number(quantity),
        }),
      `Berhasil mengkonversi ${quantity} unit dari stok`
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
            rental baru dengan kode otomatis
          </p>
        </div>

        {itemSku && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">SKU Produk:</span> {itemSku}
          </div>
        )}

        <Input
          label="Jumlah Unit"
          type="number"
          min={1}
          max={availableStock}
          value={String(quantity)}
          onChange={(e) => setQuantity(Number(e.target.value))}
          required
        />

        <p className="text-xs text-gray-500">
          Kode unit akan di-generate otomatis berdasarkan SKU produk
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
            disabled={convertMutation.isPending || quantity < 1}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {convertMutation.isPending
              ? 'Mengkonversi...'
              : `Konversi ${quantity} Unit`}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
