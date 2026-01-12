import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import FormModal from '@/components/ui/FormModal';
import { Input } from '@/components/ui';
import { apiAction } from '@/hooks/useApiAction';
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
    { enabled: isOpen }
  );

  // Fetch rental items to get productId
  const { data: rentalItems = [] } = trpc.rental.items.list.useQuery(
    undefined,
    { enabled: isOpen }
  );

  // Map shortage items with their stock info
  const shortagesWithStock = useMemo(() => {
    return shortages.map((s) => {
      const rentalItem = rentalItems.find((ri) => ri.id === s.rentalItemId);
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

  // State for conversion configs
  const [convertConfigs, setConvertConfigs] = useState<
    Record<string, { quantity: number; prefix: string; startNumber: number }>
  >({});

  // Initialize configs when shortages change
  useMemo(() => {
    const initial: Record<
      string,
      { quantity: number; prefix: string; startNumber: number }
    > = {};
    shortagesWithStock.forEach((s) => {
      if (s.hasEnoughStock && !convertConfigs[s.rentalItemId]) {
        // Generate valid prefix: uppercase alphanumeric only
        const basePrefix = s.productSku
          ? s.productSku.toUpperCase().replace(/[^A-Z0-9]/g, '')
          : 'RENT';
        initial[s.rentalItemId] = {
          quantity: Math.min(s.shortage, s.stockQty),
          prefix: basePrefix || 'RENT',
          startNumber: 1,
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

  // Single item convert (used by individual Convert buttons if needed)
  const _handleConvertSingle = async (rentalItemId: string) => {
    const config = convertConfigs[rentalItemId];
    if (!config) return;

    await apiAction(
      () =>
        convertMutation.mutateAsync({
          rentalItemId,
          quantity: config.quantity,
          prefix: config.prefix,
          startNumber: config.startNumber,
        }),
      `Berhasil mengkonversi ${config.quantity} unit dari stok`
    );

    // Refresh data
    utils.rental.items.list.invalidate();
    utils.product.list.invalidate();
    utils.rentalBundle.getComponentAvailability.invalidate();
  };
  void _handleConvertSingle; // Silence unused warning

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
          prefix: config.prefix,
          startNumber: config.startNumber,
        });
      }

      // Invalidate all relevant caches
      utils.rental.items.list.invalidate();
      utils.product.list.invalidate();
      utils.rentalBundle.getComponentAvailability.invalidate();
      onSuccess();
      onClose();
    } catch (error) {
      // Error already handled by tRPC's onError or shown via toast
      console.error('Convert error:', error);
    }
  };

  const updateConfig = (
    rentalItemId: string,
    field: 'quantity' | 'prefix' | 'startNumber',
    value: string | number
  ) => {
    setConvertConfigs((prev) => ({
      ...prev,
      [rentalItemId]: {
        ...prev[rentalItemId],
        [field]: value,
      },
    }));
  };

  const itemsWithStock = shortagesWithStock.filter((s) => s.hasEnoughStock);
  const itemsWithoutStock = shortagesWithStock.filter((s) => !s.hasEnoughStock);
  const canConvertAny = itemsWithStock.length > 0;

  // PO modal state
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);

  // Prepare items for PO prefill - include price from products query
  const poPrefilledItems: PrefillItem[] = useMemo(() => {
    return itemsWithoutStock
      .filter((item) => item.productId)
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return {
          productId: item.productId!,
          quantity: item.shortage - item.stockQty, // Only the amount we still need
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
            Konversi stok produk menjadi unit rental. Stok akan berkurang dan
            unit rental baru akan tersedia untuk di-assign.
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
                prefix: item.productSku || 'RENT',
                startNumber: 1,
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

                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      label="Prefix"
                      value={config.prefix}
                      onChange={(e) =>
                        updateConfig(item.rentalItemId, 'prefix', e.target.value)
                      }
                    />
                    <Input
                      label="Jumlah"
                      type="number"
                      min={1}
                      max={item.stockQty}
                      value={config.quantity}
                      onChange={(e) =>
                        updateConfig(
                          item.rentalItemId,
                          'quantity',
                          Math.min(
                            parseInt(e.target.value) || 1,
                            item.stockQty
                          )
                        )
                      }
                    />
                    <Input
                      label="Nomor Mulai"
                      type="number"
                      min={1}
                      value={config.startNumber}
                      onChange={(e) =>
                        updateConfig(
                          item.rentalItemId,
                          'startNumber',
                          parseInt(e.target.value) || 1
                        )
                      }
                    />
                  </div>

                  <p className="text-xs text-gray-500">
                    Preview: {config.prefix}-
                    {String(config.startNumber).padStart(3, '0')}
                    {config.quantity > 1 &&
                      ` s/d ${config.prefix}-${String(config.startNumber + config.quantity - 1).padStart(3, '0')}`}
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
              Buat Purchase Order untuk {itemsWithoutStock.length} item
            </button>

            <p className="text-sm text-amber-700">
              Untuk item di atas, silakan buat Purchase Order terlebih dahulu
              untuk menambah stok.
            </p>
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
