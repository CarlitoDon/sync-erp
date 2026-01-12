import React, { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import FormModal from '@/components/ui/FormModal';
import { Input } from '@/components/ui';
import { apiAction } from '@/hooks/useApiAction';
import { formatCurrency } from '@/utils/format';
import {
  TrashIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline';
import { UnitStatus, PartnerType } from '@sync-erp/shared';
import QuickCreateCustomerModal from './QuickCreateCustomerModal';
import {
  useRentalPricing,
  useRentalDays,
  getPricingTierLabel,
} from '../hooks';

interface OrderItem {
  type: 'item' | 'bundle';
  rentalItemId?: string;
  rentalBundleId?: string;
  quantity: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateOrderModal({
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  // Queries
  const { data: rentalItems = [], isLoading: isLoadingItems } =
    trpc.rental.items.list.useQuery(undefined, {
      enabled: isOpen && !!currentCompany?.id,
    });
  const { data: partners = [], isLoading: isLoadingPartners } =
    trpc.partner.list.useQuery(undefined, {
      enabled: isOpen && !!currentCompany?.id,
    });
  const { data: rentalBundles = [] } =
    trpc.rentalBundle.list.useQuery(
      { companyId: currentCompany?.id || '' },
      { enabled: isOpen && !!currentCompany?.id }
    );

  const isLoadingData = isLoadingItems || isLoadingPartners;

  // Mutation
  const createMutation = trpc.rental.orders.create.useMutation({
    onSuccess: () => {
      utils.rental.orders.list.invalidate();
      onSuccess?.();
      handleClose();
    },
  });

  // Form state
  // Trigger re-compile
  const [orderForm, setOrderForm] = useState({
    partnerId: '',
    rentalStartDate: new Date().toISOString().split('T')[0],
    rentalEndDate: '',
    dueDateTime: '',
    notes: '',
    items: [] as OrderItem[],
  });
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  // Calculate pricing using hooks
  const rentalDays = useRentalDays(
    orderForm.rentalStartDate,
    orderForm.rentalEndDate
  );
  const { subtotal, depositRequired } = useRentalPricing(
    orderForm.items,
    rentalItems,
    rentalDays,
    rentalBundles
  );

  const resetForm = () => {
    setOrderForm({
      partnerId: '',
      rentalStartDate: new Date().toISOString().split('T')[0],
      rentalEndDate: '',
      dueDateTime: '',
      notes: '',
      items: [],
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const addItem = () => {
    setOrderForm({
      ...orderForm,
      items: [
        ...orderForm.items,
        { type: 'item', rentalItemId: '', quantity: 1 },
      ],
    });
  };

  const updateItem = (
    idx: number,
    field: keyof OrderItem,
    value: string | number | 'item' | 'bundle'
  ) => {
    const newItems = [...orderForm.items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setOrderForm({ ...orderForm, items: newItems });
  };

  const removeItem = (idx: number) => {
    setOrderForm({
      ...orderForm,
      items: orderForm.items.filter((_, i) => i !== idx),
    });
  };

  const getAvailableUnits = (itemId: string) => {
    const item = rentalItems.find((ri) => ri.id === itemId);
    return (
      item?.units?.filter((u) => u.status === UnitStatus.AVAILABLE)
        .length || 0
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderForm.items.length === 0) return;

    const dueDateTime = orderForm.dueDateTime
      ? new Date(orderForm.dueDateTime)
      : new Date(orderForm.rentalEndDate + 'T18:00:00');

    await apiAction(
      () =>
        createMutation.mutateAsync({
          partnerId: orderForm.partnerId,
          rentalStartDate: new Date(
            orderForm.rentalStartDate
          ).toISOString(),
          rentalEndDate: new Date(
            orderForm.rentalEndDate
          ).toISOString(),
          dueDateTime: dueDateTime.toISOString(),
          notes: orderForm.notes || undefined,
          items: orderForm.items
            .filter(
              (i) =>
                (i.rentalItemId || i.rentalBundleId) && i.quantity > 0
            )
            .map((i) => ({
              rentalItemId:
                i.type === 'item' ? i.rentalItemId : undefined,
              rentalBundleId:
                i.type === 'bundle' ? i.rentalBundleId : undefined,
              quantity: i.quantity,
            })),
        }),
      'Order berhasil dibuat'
    );
  };

  const customers = useMemo(
    () => partners.filter((p) => p.type === PartnerType.CUSTOMER),
    [partners]
  );

  return (
    <>
      <QuickCreateCustomerModal
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
        onSuccess={(partnerId) => {
          setOrderForm((prev) => ({ ...prev, partnerId }));
          setIsQuickCreateOpen(false);
        }}
      />

      <FormModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Buat Order Rental Baru"
      >
        <form
          onSubmit={handleSubmit}
          className="space-y-4 max-h-[70vh] overflow-y-auto"
        >
          {/* Loading State */}
          {isLoadingData ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-10 bg-gray-200 rounded" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-10 bg-gray-200 rounded" />
                <div className="h-10 bg-gray-200 rounded" />
              </div>
              <div className="h-24 bg-gray-200 rounded" />
            </div>
          ) : (
            <>
              {/* Customer Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Customer *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickCreateOpen(true)}
                    className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                  >
                    <PlusCircleIcon className="w-4 h-4" />
                    Tambah Baru
                  </button>
                </div>
                <select
                  value={orderForm.partnerId}
                  onChange={(e) =>
                    setOrderForm({
                      ...orderForm,
                      partnerId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Pilih customer...</option>
                  {customers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rental Period */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Tanggal Mulai *"
                  type="date"
                  value={orderForm.rentalStartDate}
                  onChange={(e) =>
                    setOrderForm({
                      ...orderForm,
                      rentalStartDate: e.target.value,
                    })
                  }
                  required
                />
                <Input
                  label="Tanggal Selesai *"
                  type="date"
                  value={orderForm.rentalEndDate}
                  onChange={(e) =>
                    setOrderForm({
                      ...orderForm,
                      rentalEndDate: e.target.value,
                    })
                  }
                  min={orderForm.rentalStartDate}
                  required
                />
              </div>

              {rentalDays > 0 && (
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  Durasi: <strong>{rentalDays} hari</strong> (
                  {getPricingTierLabel(rentalDays)})
                </div>
              )}

              {/* Items */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700">
                    Item Rental
                  </h4>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    + Tambah Item
                  </button>
                </div>

                {orderForm.items.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Belum ada item. Klik "+ Tambah Item" untuk
                    memulai.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {orderForm.items.map((item, idx) => {
                      const rentalItem =
                        item.type === 'item'
                          ? rentalItems.find(
                              (ri) => ri.id === item.rentalItemId
                            )
                          : null;
                      const rentalBundle =
                        item.type === 'bundle'
                          ? rentalBundles.find(
                              (rb) => rb.id === item.rentalBundleId
                            )
                          : null;

                      const availableUnits =
                        item.type === 'item' && item.rentalItemId
                          ? getAvailableUnits(item.rentalItemId)
                          : 999; // Bundles treated as unlimited for now (or calculate based on component availability - separate task)

                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                        >
                          {/* Type Selector */}
                          <div className="w-24">
                            <select
                              value={item.type}
                              onChange={(e) => {
                                // Reset selection when type changes
                                const newItems = [...orderForm.items];
                                newItems[idx] = {
                                  ...newItems[idx],
                                  type: e.target.value as
                                    | 'item'
                                    | 'bundle',
                                  rentalItemId: '',
                                  rentalBundleId: '',
                                };
                                setOrderForm({
                                  ...orderForm,
                                  items: newItems,
                                });
                              }}
                              className="w-full px-2 py-2 border rounded-lg text-sm bg-white"
                            >
                              <option value="item">Item</option>
                              <option value="bundle">Bundle</option>
                            </select>
                          </div>

                          <div className="flex-1">
                            {item.type === 'item' ? (
                              <select
                                value={item.rentalItemId || ''}
                                onChange={(e) =>
                                  updateItem(
                                    idx,
                                    'rentalItemId',
                                    e.target.value
                                  )
                                }
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                required
                              >
                                <option value="">
                                  Pilih item...
                                </option>
                                {rentalItems.map((ri) => (
                                  <option key={ri.id} value={ri.id}>
                                    {ri.product?.name} (
                                    {ri.units?.filter(
                                      (u) =>
                                        u.status ===
                                        UnitStatus.AVAILABLE
                                    ).length || 0}{' '}
                                    tersedia)
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <select
                                value={item.rentalBundleId || ''}
                                onChange={(e) =>
                                  updateItem(
                                    idx,
                                    'rentalBundleId',
                                    e.target.value
                                  )
                                }
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                required
                              >
                                <option value="">
                                  Pilih bundle...
                                </option>
                                {rentalBundles.map((rb) => (
                                  <option key={rb.id} value={rb.id}>
                                    {rb.name} (
                                    {formatCurrency(
                                      Number(rb.dailyRate)
                                    )}
                                    /hari)
                                  </option>
                                ))}
                              </select>
                            )}

                            {(rentalItem || rentalBundle) && (
                              <p className="text-xs text-gray-500 mt-1">
                                {formatCurrency(
                                  Number(
                                    rentalItem?.dailyRate ||
                                      rentalBundle?.dailyRate ||
                                      0
                                  )
                                )}
                                /hari
                              </p>
                            )}
                          </div>
                          <div className="w-24">
                            <input
                              type="number"
                              min={1}
                              max={availableUnits || 99}
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(
                                  idx,
                                  'quantity',
                                  parseInt(e.target.value) || 1
                                )
                              }
                              className="w-full px-3 py-2 border rounded-lg text-sm text-center"
                              required
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Summary */}
              {orderForm.items.length > 0 && rentalDays > 0 && (
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Deposit yang diperlukan
                    </span>
                    <span className="font-medium text-orange-600">
                      {formatCurrency(depositRequired)}
                    </span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan
                </label>
                <textarea
                  value={orderForm.notes}
                  onChange={(e) =>
                    setOrderForm({
                      ...orderForm,
                      notes: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="Catatan opsional..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={
                    createMutation.isPending ||
                    orderForm.items.length === 0
                  }
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
                >
                  {createMutation.isPending
                    ? 'Menyimpan...'
                    : 'Buat Order'}
                </button>
              </div>
            </>
          )}
        </form>
      </FormModal>
    </>
  );
}
