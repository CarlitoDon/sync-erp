import React, { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import FormModal from '@/components/ui/FormModal';
import { apiAction } from '@/hooks/useApiAction';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { UnitStatus } from '@sync-erp/shared';
import type { RentalOrderWithRelations } from '@sync-erp/shared';
import { PhotoUploader } from '../components';
import { CONDITION_OPTIONS } from '../constants';

interface UnitAssignment {
  unitId: string;
  unitCode: string;
  condition: string;
  beforePhotos: string[];
  notes: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: RentalOrderWithRelations | null;
  onSuccess: () => void;
}

export default function UnitAssignmentModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: Props) {
  const utils = trpc.useUtils();

  // Fetch available units for each item in the order
  const { data: rentalItems = [] } = trpc.rental.items.list.useQuery(
    undefined,
    { enabled: isOpen }
  );

  const releaseMutation = trpc.rental.orders.release.useMutation({
    onSuccess: () => {
      utils.rental.orders.list.invalidate();
      onSuccess();
      onClose();
    },
  });

  // State for unit assignments
  const [assignments, setAssignments] = useState<UnitAssignment[]>(
    []
  );

  // Get RESERVED units from order assignments (for release flow)
  const reservedUnitsByItem = useMemo(() => {
    const result: Record<
      string,
      { id: string; unitCode: string; condition: string }[]
    > = {};

    const unitAssignments = order?.unitAssignments || [];

    if (unitAssignments.length > 0) {
      order?.items?.forEach((item) => {
        if (!item.rentalItemId) return; // Skip bundle items
        result[item.rentalItemId] = [];
      });

      unitAssignments.forEach((assignment) => {
        const unit = assignment.rentalItemUnit;
        if (unit && unit.rentalItemId && result[unit.rentalItemId]) {
          result[unit.rentalItemId].push({
            id: unit.id,
            unitCode: unit.unitCode,
            condition: unit.condition,
          });
        }
      });
    } else {
      order?.items?.forEach((item) => {
        if (!item.rentalItemId) return; // Skip bundle items
        const rentalItem = rentalItems.find(
          (ri) => ri.id === item.rentalItemId
        );
        if (rentalItem?.units) {
          result[item.rentalItemId] = rentalItem.units
            .filter(
              (u) =>
                u.status === UnitStatus.AVAILABLE ||
                u.status === UnitStatus.RESERVED
            )
            .map((u) => ({
              id: u.id,
              unitCode: u.unitCode,
              condition: u.condition,
            }));
        }
      });
    }

    return result;
  }, [order, rentalItems]);

  // Calculate required units per item
  const requiredUnits = useMemo(() => {
    const result: {
      itemId: string;
      itemName: string;
      quantity: number;
    }[] = [];
    order?.items?.forEach((item) => {
      if (!item.rentalItemId) return; // Skip bundle items
      result.push({
        itemId: item.rentalItemId,
        itemName:
          item.rentalItem?.product?.name ||
          item.rentalBundle?.name ||
          'Unknown',
        quantity: item.quantity,
      });
    });
    return result;
  }, [order]);

  // Check if all units are assigned
  const allUnitsAssigned = useMemo(() => {
    const totalRequired = requiredUnits.reduce(
      (sum, r) => sum + r.quantity,
      0
    );
    return assignments.length >= totalRequired;
  }, [assignments, requiredUnits]);

  const toggleUnitSelection = (unit: {
    id: string;
    unitCode: string;
    condition: string;
  }) => {
    const existing = assignments.find((a) => a.unitId === unit.id);
    if (existing) {
      setAssignments(assignments.filter((a) => a.unitId !== unit.id));
    } else {
      setAssignments([
        ...assignments,
        {
          unitId: unit.id,
          unitCode: unit.unitCode,
          condition: unit.condition,
          beforePhotos: [],
          notes: '',
        },
      ]);
    }
  };

  const handleAddPhoto = (unitId: string, base64: string) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.unitId === unitId
          ? { ...a, beforePhotos: [...a.beforePhotos, base64] }
          : a
      )
    );
  };

  const handleRemovePhoto = (unitId: string, photoIndex: number) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.unitId === unitId
          ? {
              ...a,
              beforePhotos: a.beforePhotos.filter(
                (_, i) => i !== photoIndex
              ),
            }
          : a
      )
    );
  };

  const handleRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || assignments.length === 0) return;

    const payload = {
      orderId: order.id,
      unitAssignments: assignments.map((a) => ({
        unitId: a.unitId,
        beforePhotos:
          a.beforePhotos.length > 0
            ? a.beforePhotos
            : ['placeholder-photo'],
        condition: a.condition as
          | 'NEW'
          | 'GOOD'
          | 'FAIR'
          | 'NEEDS_REPAIR',
        notes: a.notes || undefined,
      })),
    };

    await apiAction(
      () => releaseMutation.mutateAsync(payload),
      'Unit berhasil diserahkan ke customer'
    );
  };

  if (!order) return null;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Serah Terima Unit - ${order.orderNumber}`}
    >
      <form
        onSubmit={handleRelease}
        className="space-y-4 max-h-[70vh] overflow-y-auto"
      >
        {/* Order Summary */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between mb-2">
            <span className="text-gray-500">Customer:</span>
            <span className="font-medium">{order.partner?.name}</span>
          </div>
          <div className="text-sm text-gray-600">
            Unit yang dibutuhkan:
            {requiredUnits.map((r) => (
              <span
                key={r.itemId}
                className="ml-2 px-2 py-0.5 bg-gray-200 rounded"
              >
                {r.quantity}x {r.itemName}
              </span>
            ))}
          </div>
        </div>

        {/* Unit Selection */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Pilih Unit yang Akan Diserahkan
          </h4>

          {requiredUnits.map((req) => (
            <div key={req.itemId} className="mb-4">
              <h5 className="text-sm font-medium text-gray-600 mb-2">
                {req.itemName} ({req.quantity} unit dibutuhkan)
              </h5>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {reservedUnitsByItem[req.itemId]?.map((unit) => {
                  const isSelected = assignments.some(
                    (a) => a.unitId === unit.id
                  );
                  const conditionStyle =
                    CONDITION_OPTIONS.find(
                      (c) => c.value === unit.condition
                    )?.color || 'bg-gray-100';

                  return (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => toggleUnitSelection(unit)}
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
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${conditionStyle}`}
                      >
                        {
                          CONDITION_OPTIONS.find(
                            (c) => c.value === unit.condition
                          )?.label
                        }
                      </span>
                    </button>
                  );
                })}
                {(!reservedUnitsByItem[req.itemId] ||
                  reservedUnitsByItem[req.itemId].length === 0) && (
                  <p className="col-span-full text-sm text-red-600">
                    Tidak ada unit tersedia untuk item ini
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Selected Units Details with Photo Upload */}
        {assignments.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Unit Terpilih ({assignments.length}) - Tambah Foto
              Kondisi
            </h4>
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.unitId}
                  className="p-3 bg-primary-50 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-semibold">
                      {assignment.unitCode}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        toggleUnitSelection({
                          id: assignment.unitId,
                          unitCode: assignment.unitCode,
                          condition: assignment.condition,
                        })
                      }
                      className="text-red-600 hover:text-red-700"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Photo Upload Section */}
                  <PhotoUploader
                    photos={assignment.beforePhotos}
                    onAdd={(base64) =>
                      handleAddPhoto(assignment.unitId, base64)
                    }
                    onRemove={(photoIdx) =>
                      handleRemovePhoto(assignment.unitId, photoIdx)
                    }
                    label="Tambah foto kondisi unit sebelum diserahkan"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={!allUnitsAssigned || releaseMutation.isPending}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {releaseMutation.isPending
              ? 'Memproses...'
              : `Serahkan ${assignments.length} Unit`}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
