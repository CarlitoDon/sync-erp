import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import FormModal from '@/components/ui/FormModal';
import { Input } from '@/components/ui';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import CreatePurchaseOrderModal, {
  type PrefillItem,
} from '@/features/procurement/components/CreatePurchaseOrderModal';

interface ShortageItem {
  rentalItemId: string;
  productId?: string;
  productName: string;
  productSku: string;
  shortage: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  shortages: ShortageItem[];
  onSuccess: () => void;
}

export default function QuickAddUnitsModal({
  isOpen,
  onClose,
  shortages,
  onSuccess,
}: Props) {
  const utils = trpc.useUtils();

  // Fetch product stock for each shortage item
  const { data: products = [] } = trpc.product.list.useQuery(
    undefined,
    {
      enabled: isOpen,
    }
  );

  // Fetch rental items to get productId
  const { data: rentalItems = [] } = trpc.rental.items.list.useQuery(
    undefined,
    { enabled: isOpen }
  );

  // Map shortage items with their stock info
  const shortagesWithStock = useMemo(() => {
    return shortages.map((s) => {
      const rentalItem = rentalItems.find(
        (ri) => ri.id === s.rentalItemId
      );
      const product = rentalItem
        ? products.find((p) => p.id === rentalItem.productId)
        : null;

      return {
        ...s,
        productId: rentalItem?.productId,
        stockQty: product?.stockQty ?? 0,
        hasEnoughStock: (product?.stockQty ?? 0) >= s.shortage,
      };
    });
  }, [shortages, rentalItems, products]);

  // State for conversion configs - simplified: only quantity
  const [convertConfigs, setConvertConfigs] = useState<
    Record<string, { quantity: number }>
  >({});

  // Initialize configs when shortages change
  useMemo(() => {
    const initial: Record<string, { quantity: number }> = {};
    shortagesWithStock.forEach((s) => {
      if (s.hasEnoughStock && !convertConfigs[s.rentalItemId]) {
        initial[s.rentalItemId] = {
          quantity: Math.min(s.shortage, s.stockQty),
        };
      }
    });
    if (Object.keys(initial).length > 0) {
      setConvertConfigs((prev) => ({ ...prev, ...initial }));
    }
  }, [shortagesWithStock]);

  const convertMutation = trpc.rental.items.convertStock.useMutation({
    onSuccess: () => {
      utils.rental.items.list.invalidate();
      utils.product.list.invalidate();
    },
  });

  const handleConvertAll = async () => {
    const itemsToConvert = shortagesWithStock.filter(
      (s) => s.hasEnoughStock && convertConfigs[s.rentalItemId]
    );

    try {
      for (const item of itemsToConvert) {
        const config = convertConfigs[item.rentalItemId];
        if (!config) continue;

        await convertMutation.mutateAsync({
          rentalItemId: item.rentalItemId,
          quantity: config.quantity,
          // No prefix/startNumber - unit codes auto-generated!
        });
      }

      // Invalidate all relevant caches
      utils.rental.items.list.invalidate();
      utils.product.list.invalidate();
      utils.rentalBundle.getComponentAvailability.invalidate();
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Convert error:', error);
    }
  };

  const updateConfig = (rentalItemId: string, quantity: number) => {
    setConvertConfigs((prev) => ({
      ...prev,
      [rentalItemId]: { quantity },
    }));
  };

  const itemsWithStock = shortagesWithStock.filter(
    (s) => s.hasEnoughStock
  );
  const itemsWithoutStock = shortagesWithStock.filter(
    (s) => !s.hasEnoughStock
  );
  const canConvertAny = itemsWithStock.length > 0;

  // PO modal state
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);

  // Prepare items for PO prefill
  const poPrefilledItems: PrefillItem[] = useMemo(() => {
    return itemsWithoutStock
      .filter((item) => item.productId)
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return {
          productId: item.productId!,
          quantity: item.shortage - item.stockQty,
          price: product?.price ? Number(product.price) : undefined,
        };
      });
  }, [itemsWithoutStock, products]);

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Konversi Stok ke Unit Rental"
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Info */}
        <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
          <p>
            Konversi stok produk menjadi unit rental. Kode unit akan
            di-generate otomatis.
          </p>
        </div>

        {/* Items with enough stock */}
        {itemsWithStock.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-green-500" />
              Siap Dikonversi ({itemsWithStock.length})
            </h4>

            {itemsWithStock.map((item) => {
              const config = convertConfigs[item.rentalItemId] ?? {
                quantity: item.shortage,
              };

              return (
                <div
                  key={item.rentalItemId}
                  className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.productName}
                      </p>
                      <p className="text-sm text-gray-600">
                        Kurang: {item.shortage} unit | Stok tersedia:{' '}
                        <span className="font-medium text-green-600">
                          {item.stockQty}
                        </span>
                      </p>
                    </div>
                  </div>

                  <Input
                    label="Jumlah Konversi"
                    type="number"
                    min={1}
                    max={item.stockQty}
                    value={config.quantity}
                    onChange={(e) =>
                      updateConfig(
                        item.rentalItemId,
                        Math.min(
                          parseInt(e.target.value) || 1,
                          item.stockQty
                        )
                      )
                    }
                  />

                  <p className="text-xs text-gray-500">
                    Kode unit akan di-generate otomatis
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Items without enough stock - need PO */}
        {itemsWithoutStock.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
              Stok Tidak Cukup ({itemsWithoutStock.length})
            </h4>

            {itemsWithoutStock.map((item) => (
              <div
                key={item.rentalItemId}
                className="border border-amber-200 bg-amber-50 rounded-lg p-4"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.productName}
                    </p>
                    <p className="text-sm text-gray-600">
                      Kurang: {item.shortage} unit | Stok:{' '}
                      <span className="font-medium text-red-600">
                        {item.stockQty}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setIsPOModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors"
            >
              <ShoppingCartIcon className="w-5 h-5" />
              Buat Purchase Order untuk {
                itemsWithoutStock.length
              }{' '}
              item
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t mt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Tutup
        </button>
        {canConvertAny && (
          <button
            type="button"
            onClick={handleConvertAll}
            disabled={convertMutation.isPending}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {convertMutation.isPending
              ? 'Memproses...'
              : `Konversi ${itemsWithStock.length} Item`}
          </button>
        )}
      </div>

      {/* PO Creation Modal */}
      <CreatePurchaseOrderModal
        isOpen={isPOModalOpen}
        onClose={() => setIsPOModalOpen(false)}
        initialItems={poPrefilledItems}
        title="Buat PO untuk Stok Rental"
        onSuccess={() => {
          setIsPOModalOpen(false);
          utils.product.list.invalidate();
        }}
      />
    </FormModal>
  );
}
