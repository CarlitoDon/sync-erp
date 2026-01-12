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

interface ComponentAvailability {
  rentalItemId: string;
  componentLabel: string;
  productName: string;
  productSku: string;
  requiredQty: number;
  availableQty: number;
  shortage: number;
  hasShortage: boolean;
}

interface BundleAvailability {
  bundleId: string;
  bundleName: string;
  orderQuantity: number;
  components: ComponentAvailability[];
  hasAnyShortage: boolean;
  totalShortage: number;
}

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
    return (
      order?.items?.filter((item) => item.rentalBundleId) ?? []
    );
  }, [order]);

  // Get first bundle ID for single query (handles most common case)
  const firstBundleId = bundleItems[0]?.rentalBundleId;
  const firstBundleQty = bundleItems[0]?.quantity ?? 1;

  // Fetch availability for the first bundle (single query, not in loop)
  const { data: bundleAvailabilityData } =
    trpc.rentalBundle.getComponentAvailability.useQuery(
      {
        bundleId: firstBundleId!,
        orderQuantity: firstBundleQty,
      },
      { enabled: isOpen && !!firstBundleId }
    );

  // Wrap in array for consistency with UI
  const bundleAvailabilities: BundleAvailability[] = useMemo(() => {
    if (!bundleAvailabilityData) return [];
    return [bundleAvailabilityData];
  }, [bundleAvailabilityData]);

  // Check if any bundle has shortage
  const hasBundleShortage = useMemo(() => {
    return bundleAvailabilities.some((b) => b.hasAnyShortage);
  }, [bundleAvailabilities]);

  // Collect all shortages for QuickAddUnitsModal
  const allShortages = useMemo(() => {
    const shortages: {
      rentalItemId: string;
      productName: string;
      productSku: string;
      shortage: number;
    }[] = [];

    bundleAvailabilities.forEach((bundle) => {
      bundle.components
        .filter((c) => c.hasShortage)
        .forEach((c) => {
          // Avoid duplicates if same item in multiple bundles
          const existing = shortages.find(
            (s) => s.rentalItemId === c.rentalItemId
          );
          if (existing) {
            existing.shortage = Math.max(
              existing.shortage,
              c.shortage
            );
          } else {
            shortages.push({
              rentalItemId: c.rentalItemId,
              productName: c.productName,
              productSku: c.productSku,
              shortage: c.shortage,
            });
          }
        });
    });

    return shortages;
  }, [bundleAvailabilities]);

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

  // Get available units for items in the order
  const availableUnitsByItem = useMemo(() => {
    const result: Record<
      string,
      { id: string; unitCode: string; condition: string }[]
    > = {};

    order?.items?.forEach((item) => {
      if (!item.rentalItemId) return; // Skip bundle items - handled separately
      const rentalItem = rentalItems.find(
        (ri) => ri.id === item.rentalItemId
      );
      if (rentalItem?.units) {
        result[item.rentalItemId] = rentalItem.units
          .filter((u) => u.status === UnitStatus.AVAILABLE)
          .map((u) => ({
            id: u.id,
            unitCode: u.unitCode,
            condition: u.condition,
          }));
      }
    });

    return result;
  }, [order, rentalItems]);

  // Get available units for bundle components
  const bundleComponentUnits = useMemo(() => {
    const result: Record<
      string,
      { id: string; unitCode: string; condition: string; productName: string }[]
    > = {};

    // For each bundle availability component, find available units
    bundleAvailabilities.forEach((bundle) => {
      bundle.components.forEach((comp) => {
        const rentalItem = rentalItems.find(
          (ri) => ri.id === comp.rentalItemId
        );
        if (rentalItem?.units) {
          result[comp.rentalItemId] = rentalItem.units
            .filter((u) => u.status === UnitStatus.AVAILABLE)
            .map((u) => ({
              id: u.id,
              unitCode: u.unitCode,
              condition: u.condition,
              productName: comp.productName,
            }));
        }
      });
    });

    return result;
  }, [bundleAvailabilities, rentalItems]);

  // Calculate required units - for bundle, count components * quantity
  const requiredUnits = useMemo(() => {
    if (bundleItems.length > 0) {
      // Bundle order: count total components needed
      let total = 0;
      bundleAvailabilities.forEach((bundle) => {
        bundle.components.forEach((comp) => {
          total += comp.requiredQty;
        });
      });
      return total;
    }
    // Regular order
    let total = 0;
    order?.items?.forEach((item) => {
      total += item.quantity;
    });
    return total;
  }, [order, bundleItems, bundleAvailabilities]);

  // Check if enough units selected
  const canConfirm = selectedUnits.length >= requiredUnits;

  // Check if enough units available (for regular items only)
  const totalAvailable = useMemo(() => {
    let count = 0;
    Object.values(availableUnitsByItem).forEach((units) => {
      count += units.length;
    });
    return count;
  }, [availableUnitsByItem]);

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
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-gray-500">Customer:</span>
                <span className="font-medium">
                  {order.partner?.name}
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-500">Total Order:</span>
                <span className="font-semibold">
                  Rp {Number(order.subtotal).toLocaleString('id-ID')}
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

            {/* Check availability first - Bundle Component Breakdown */}
            {hasBundleShortage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-2 mb-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">
                      Unit Tidak Cukup untuk Bundle
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      Beberapa komponen bundle tidak memiliki unit yang
                      tersedia. Tambahkan unit terlebih dahulu.
                    </p>
                  </div>
                </div>

                {/* Bundle Component Breakdown */}
                {bundleAvailabilities.map((bundle) => (
                  <div key={bundle.bundleId} className="mt-3">
                    <p className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-1">
                      <CubeIcon className="w-4 h-4" />
                      {bundle.bundleName} ({bundle.orderQuantity}x)
                    </p>
                    <div className="space-y-1.5 ml-5">
                      {bundle.components.map((comp) => (
                        <div
                          key={comp.rentalItemId}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            {comp.hasShortage ? (
                              <XCircleIcon className="w-4 h-4 text-red-500" />
                            ) : (
                              <CheckCircleIcon className="w-4 h-4 text-green-500" />
                            )}
                            <span
                              className={
                                comp.hasShortage
                                  ? 'text-red-700'
                                  : 'text-gray-700'
                              }
                            >
                              {comp.componentLabel || comp.productName}
                            </span>
                          </div>
                          <span
                            className={`text-xs ${comp.hasShortage ? 'text-red-600 font-medium' : 'text-gray-500'}`}
                          >
                            {comp.availableQty}/{comp.requiredQty}{' '}
                            tersedia
                            {comp.hasShortage && (
                              <span className="ml-1 text-red-700">
                                [-{comp.shortage}]
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Quick Add Units Button */}
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(true)}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <PlusIcon className="w-4 h-4" />
                  Tambah {allShortages.reduce((s, i) => s + i.shortage, 0)} Unit yang Kurang
                </button>
              </div>
            )}

            {/* Regular item shortage (non-bundle) - only show if order has non-bundle items */}
            {!hasBundleShortage && bundleItems.length === 0 && totalAvailable < requiredUnits && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                <p className="font-medium">⚠️ Unit Tidak Cukup!</p>
                <p className="text-sm mt-1">
                  Dibutuhkan {requiredUnits} unit, tapi hanya{' '}
                  {totalAvailable} unit tersedia. Tambahkan unit
                  terlebih dahulu.
                </p>
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
                disabled={hasBundleShortage || (bundleItems.length === 0 && totalAvailable < requiredUnits)}
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

            {/* Bundle order: show components */}
            {bundleItems.length > 0 && bundleAvailabilities.map((bundle) => (
              <div key={bundle.bundleId} className="space-y-4">
                <h4 className="font-medium text-gray-800">
                  {bundle.bundleName} - Pilih unit untuk setiap komponen:
                </h4>
                {bundle.components.map((comp) => {
                  const units = bundleComponentUnits[comp.rentalItemId] || [];
                  return (
                    <div
                      key={comp.rentalItemId}
                      className="border rounded-lg p-4"
                    >
                      <h5 className="font-medium text-gray-700 mb-3">
                        {comp.productName} ({comp.requiredQty} unit dibutuhkan)
                      </h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {units.map((unit) => {
                          const isSelected = selectedUnits.includes(unit.id);
                          return (
                            <button
                              key={unit.id}
                              type="button"
                              onClick={() => toggleUnit(unit.id)}
                              className={`p-3 rounded-lg border-2 text-left transition-all ${
                                isSelected
                                  ? 'border-primary-500 bg-primary-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-semibold text-sm">
                                  {unit.unitCode}
                                </span>
                                {isSelected && (
                                  <CheckIcon className="w-5 h-5 text-primary-600" />
                                )}
                              </div>
                              <span className="text-xs text-gray-500">
                                {unit.condition}
                              </span>
                            </button>
                          );
                        })}
                        {units.length === 0 && (
                          <p className="col-span-full text-sm text-red-600">
                            Tidak ada unit tersedia
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Regular order: show items */}
            {bundleItems.length === 0 && order.items
              ?.filter((item) => item.rentalItemId)
              .map((item) => (
                <div
                  key={item.rentalItemId ?? item.id}
                  className="border rounded-lg p-4"
                >
                  <h4 className="font-medium text-gray-800 mb-3">
                    {item.rentalItem?.product?.name} ({item.quantity}{' '}
                    unit dibutuhkan)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {(
                      (item.rentalItemId &&
                        availableUnitsByItem[item.rentalItemId]) ||
                      []
                    ).map(
                      (unit: {
                        id: string;
                        unitCode: string;
                        condition: string;
                      }) => {
                        const isSelected = selectedUnits.includes(
                          unit.id
                        );
                        return (
                          <button
                            key={unit.id}
                            type="button"
                            onClick={() => toggleUnit(unit.id)}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                              isSelected
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-semibold">
                                {unit.unitCode}
                              </span>
                              {isSelected && (
                                <CheckIcon className="w-5 h-5 text-primary-600" />
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {unit.condition}
                            </span>
                          </button>
                        );
                      }
                    )}
                    {(!item.rentalItemId ||
                      !availableUnitsByItem[item.rentalItemId] ||
                      availableUnitsByItem[item.rentalItemId]
                        .length === 0) && (
                      <p className="col-span-full text-sm text-red-600">
                        Tidak ada unit tersedia untuk item ini
                      </p>
                    )}
                  </div>
                </div>
              ))}

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
