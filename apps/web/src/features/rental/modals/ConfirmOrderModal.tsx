import React, { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import FormModal from '@/components/ui/FormModal';
import { CurrencyInput } from '@/components/ui';
import { apiAction } from '@/hooks/useApiAction';
import {
  CheckIcon,
  BanknotesIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { UnitStatus, PaymentMethod } from '@sync-erp/shared';
import type { RentalOrderWithRelations } from '@sync-erp/shared';
import { PAYMENT_METHOD_OPTIONS } from '../constants';
import QuickAddUnitsModal from './QuickAddUnitsModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: RentalOrderWithRelations | null;
  onSuccess: () => void;
}

// BundleAvailability interface removed as unused

export default function ConfirmOrderModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: Props) {
  const utils = trpc.useUtils();

  // Step: 1 = deposit, 2 = unit selection
  const [step, setStep] = useState<1 | 2>(1);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);

  // Fetch available units
  const { data: rentalItems = [] } = trpc.rental.items.list.useQuery(
    undefined,
    { enabled: isOpen }
  );

  // Get bundle IDs from order items
  const bundleItems = useMemo(() => {
    return order?.items?.filter((item) => item.rentalBundleId) ?? [];
  }, [order]);

  // Get standalone (non-bundle) items
  const standaloneItems = useMemo(() => {
    return (
      order?.items?.filter(
        (item) => item.rentalItemId && !item.rentalBundleId
      ) ?? []
    );
  }, [order]);

  // Build unified component/item requirements from ALL order items
  // This replaces the per-bundle query approach
  const allRequiredItems = useMemo(() => {
    const requirements: {
      key: string; // unique key for grouping
      rentalItemId: string;
      productName: string;
      requiredQty: number;
      sourceLabel: string; // "King (Pkt)" or "Bantal"
      isBundle: boolean;
    }[] = [];

    // Process bundle items - each bundle has components
    bundleItems.forEach((item) => {
      const bundle = item.rentalBundle;
      if (!bundle?.components) return;

      bundle.components.forEach((comp) => {
        const compRentalItemId = comp.rentalItem?.id;
        if (!compRentalItemId) return;

        const existing = requirements.find(
          (r) => r.rentalItemId === compRentalItemId
        );
        if (existing) {
          existing.requiredQty += comp.quantity * item.quantity;
        } else {
          requirements.push({
            key: `bundle-${item.id}-${compRentalItemId}`,
            rentalItemId: compRentalItemId,
            productName: comp.rentalItem?.product?.name ?? 'Unknown', // componentLabel might not be on prisma type, safest is product name
            requiredQty: comp.quantity * item.quantity,
            sourceLabel: bundle.name,
            isBundle: true,
          });
        }
      });
    });

    // Process standalone items
    standaloneItems.forEach((item) => {
      if (!item.rentalItemId) return;
      const existing = requirements.find(
        (r) => r.rentalItemId === item.rentalItemId
      );
      if (existing) {
        existing.requiredQty += item.quantity;
      } else {
        requirements.push({
          key: `item-${item.id}`,
          rentalItemId: item.rentalItemId,
          productName: item.rentalItem?.product?.name ?? 'Unknown',
          requiredQty: item.quantity,
          sourceLabel: item.rentalItem?.product?.name ?? 'Item',
          isBundle: false,
        });
      }
    });

    return requirements;
  }, [bundleItems, standaloneItems]);

  // Build availability info for each required item from fetched rental items
  const itemAvailabilities = useMemo(() => {
    return allRequiredItems.map((req) => {
      const rentalItem = rentalItems.find(
        (ri) => ri.id === req.rentalItemId
      );
      const availableUnits =
        rentalItem?.units?.filter(
          (u) => u.status === UnitStatus.AVAILABLE
        ) ?? [];
      return {
        ...req,
        availableQty: availableUnits.length,
        shortage: Math.max(
          0,
          req.requiredQty - availableUnits.length
        ),
        hasShortage: availableUnits.length < req.requiredQty,
        units: availableUnits,
      };
    });
  }, [allRequiredItems, rentalItems]);

  // NOTE: hasBundleShortage removed - we now use unified allShortages display

  // Collect all shortages for QuickAddUnitsModal
  const allShortages = useMemo(() => {
    return itemAvailabilities
      .filter((item) => item.hasShortage)
      .map((item) => ({
        rentalItemId: item.rentalItemId,
        productName: item.productName,
        productSku: '',
        shortage: item.shortage,
      }));
  }, [itemAvailabilities]);

  const confirmMutation = trpc.rental.orders.confirm.useMutation({
    onSuccess: () => {
      utils.rental.orders.list.invalidate();
      utils.rental.items.list.invalidate();
      onSuccess();
      handleClose();
    },
  });

  // State
  const [depositAmount, setDepositAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState(
    PaymentMethod.CASH
  );
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen && order) {
      setStep(1);
      setDepositAmount(Number(order.subtotal) * 0.5); // Default 50% deposit
      setPaymentMethod(PaymentMethod.CASH);
      setSelectedUnits([]);
    }
  }, [isOpen, order]);

  // NOTE: availableUnitsByItem removed - unified requiredItemUnits used instead

  // Get available units for ALL required items (bundled or standalone)
  const requiredItemUnits = useMemo(() => {
    const result: Record<
      string,
      {
        id: string;
        unitCode: string;
        condition: string;
        productName: string;
      }[]
    > = {};

    allRequiredItems.forEach((req) => {
      const rentalItem = rentalItems.find(
        (ri) => ri.id === req.rentalItemId
      );
      if (rentalItem?.units) {
        result[req.rentalItemId] = rentalItem.units
          .filter((u) => u.status === UnitStatus.AVAILABLE)
          .map((u) => ({
            id: u.id,
            unitCode: u.unitCode,
            condition: u.condition,
            productName: req.productName,
          }));
      }
    });

    return result;
  }, [allRequiredItems, rentalItems]);

  // Calculate total required units
  const requiredUnits = useMemo(() => {
    return allRequiredItems.reduce(
      (sum, req) => sum + req.requiredQty,
      0
    );
  }, [allRequiredItems]);

  // Check if enough units selected
  const canConfirm = selectedUnits.length >= requiredUnits;

  // NOTE: totalAvailable removed - we now use allShortages for availability check

  const toggleUnit = (unitId: string) => {
    if (selectedUnits.includes(unitId)) {
      setSelectedUnits(selectedUnits.filter((id) => id !== unitId));
    } else {
      if (selectedUnits.length < requiredUnits) {
        setSelectedUnits([...selectedUnits, unitId]);
      }
    }
  };

  const handleConfirm = async () => {
    if (!order || !canConfirm) return;

    await apiAction(
      () =>
        confirmMutation.mutateAsync({
          orderId: order.id,
          depositAmount,
          paymentMethod,
          unitAssignments: selectedUnits.map((unitId) => ({
            unitId,
          })),
        }),
      'Order dikonfirmasi dan unit berhasil di-reserve'
    );
  };

  const handleClose = () => {
    setStep(1);
    setSelectedUnits([]);
    onClose();
  };

  if (!order) return null;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Konfirmasi Order - ${order.orderNumber}`}
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div
            className={`flex items-center gap-2 ${step === 1 ? 'text-primary-600 font-semibold' : 'text-gray-400'}`}
          >
            <BanknotesIcon className="w-5 h-5" />
            <span>1. Deposit</span>
          </div>
          <div className="w-8 border-t border-gray-300" />
          <div
            className={`flex items-center gap-2 ${step === 2 ? 'text-primary-600 font-semibold' : 'text-gray-400'}`}
          >
            <CubeIcon className="w-5 h-5" />
            <span>2. Pilih Unit</span>
          </div>
        </div>

        {/* Step 1: Deposit */}
        {step === 1 && (
          <>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Customer:</span>
                <span className="font-medium">
                  {order.partner?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal:</span>
                <span className="font-medium">
                  Rp {Number(order.subtotal).toLocaleString('id-ID')}
                </span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>
                    Diskon{' '}
                    {order.discountLabel
                      ? `(${order.discountLabel})`
                      : ''}
                  </span>
                  <span className="font-medium">
                    -Rp{' '}
                    {Number(order.discountAmount).toLocaleString(
                      'id-ID'
                    )}
                  </span>
                </div>
              )}
              {Number(order.deliveryFee) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Ongkir:</span>
                  <span className="font-medium">
                    Rp{' '}
                    {Number(order.deliveryFee).toLocaleString(
                      'id-ID'
                    )}
                  </span>
                </div>
              )}
              <hr className="my-1" />
              <div className="flex justify-between">
                <span className="text-gray-700 font-semibold">
                  Total Order:
                </span>
                <span className="font-bold">
                  Rp{' '}
                  {Number(order.totalAmount).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">
                  Unit Dibutuhkan:
                </span>
                <span className="font-medium">
                  {requiredUnits} unit
                </span>
              </div>
            </div>

            {/* Unified Shortage Display - shows ALL items that are short */}
            {allShortages.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-2 mb-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">
                      Unit Tidak Cukup!
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      Beberapa komponen tidak memiliki unit yang
                      cukup. Tambahkan unit terlebih dahulu.
                    </p>
                  </div>
                </div>

                {/* Unified shortage list - all components regardless of bundle/standalone */}
                <div className="space-y-1.5 ml-7 mb-4">
                  {allShortages.map((shortage) => (
                    <div
                      key={shortage.rentalItemId}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <XCircleIcon className="w-4 h-4 text-red-500" />
                        <span className="text-red-700">
                          {shortage.productName}
                        </span>
                      </div>
                      <span className="text-xs text-red-600 font-medium">
                        Kurang {shortage.shortage} unit
                      </span>
                    </div>
                  ))}
                </div>

                {/* Quick Add Units Button */}
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <PlusIcon className="w-4 h-4" />
                  Tambah{' '}
                  {allShortages.reduce(
                    (s, i) => s + i.shortage,
                    0
                  )}{' '}
                  Unit yang Kurang
                </button>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jumlah Deposit Diterima *
              </label>
              <CurrencyInput
                value={depositAmount}
                onChange={setDepositAmount}
                placeholder="Masukkan jumlah deposit"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Metode Pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(
                    e.target.value as typeof PaymentMethod.CASH
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {PAYMENT_METHOD_OPTIONS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={allShortages.length > 0}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                Lanjut Pilih Unit →
              </button>
            </div>
          </>
        )}

        {/* Step 2: Unit Selection */}
        {step === 2 && (
          <>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-blue-800 font-medium">
                Pilih {requiredUnits} unit untuk di-reserve
              </p>
              <p className="text-blue-600 text-sm mt-1">
                Terpilih: {selectedUnits.length} / {requiredUnits}{' '}
                unit
              </p>
            </div>

            <div className="space-y-6">
              {allRequiredItems.map((item, idx) => (
                <div key={`${item.key}-${idx}`}>
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    {item.isBundle ? (
                      <CubeIcon className="w-5 h-5 text-gray-500" />
                    ) : (
                      <CheckCircleIcon className="w-5 h-5 text-gray-500" />
                    )}
                    {item.productName} ({item.requiredQty} unit
                    dibutuhkan)
                    {item.isBundle && (
                      <span className="text-xs text-gray-500 font-normal">
                        — dari {item.sourceLabel}
                      </span>
                    )}
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {/* Render available units for this item */}
                    {(requiredItemUnits[item.rentalItemId] || []).map(
                      (unit) => {
                        const isSelected = selectedUnits.includes(
                          unit.id
                        );
                        const isAssignedToOther =
                          order.unitAssignments?.some(
                            (ua) => ua.rentalItemUnitId === unit.id
                          );

                        if (isAssignedToOther) return null;

                        return (
                          <button
                            key={unit.id}
                            type="button"
                            onClick={() => toggleUnit(unit.id)}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              isSelected
                                ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono font-medium text-gray-900">
                                {unit.unitCode}
                              </span>
                              {isSelected && (
                                <CheckIcon className="w-5 h-5 text-primary-600" />
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {unit.condition}
                            </div>
                          </button>
                        );
                      }
                    )}

                    {/* Empty state if no units available */}
                    {(!requiredItemUnits[item.rentalItemId] ||
                      requiredItemUnits[item.rentalItemId].length ===
                        0) && (
                      <div className="col-span-full py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <p className="text-gray-500 text-sm">
                          Tidak ada unit tersedia untuk komponen ini
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                ← Kembali
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!canConfirm || confirmMutation.isPending}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {confirmMutation.isPending
                    ? 'Memproses...'
                    : `Konfirmasi & Reserve ${selectedUnits.length} Unit`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick Add Units Modal */}
      <QuickAddUnitsModal
        isOpen={showQuickAddModal}
        onClose={() => setShowQuickAddModal(false)}
        shortages={allShortages}
        onSuccess={() => {
          // Refetch bundle availability
          utils.rentalBundle.getComponentAvailability.invalidate();
          utils.rental.items.list.invalidate();
        }}
      />
    </FormModal>
  );
}
