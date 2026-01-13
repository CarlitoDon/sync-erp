import React, { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import FormModal from '@/components/ui/FormModal';
import { apiAction } from '@/hooks/useApiAction';
import { toast } from 'react-hot-toast';
import {
  RentalOrderWithRelations,
  UnitCondition,
} from '@sync-erp/shared';
import { PhotoUploader } from '../components';
import {
  CONDITION_OPTIONS,
  DAMAGE_SEVERITY_OPTIONS,
} from '../constants';

interface UnitReturnData {
  unitId: string;
  unitCode: string;
  condition: string;
  damageSeverity: string;
  damageNotes: string;
  afterPhotos: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: RentalOrderWithRelations | null;
  onSuccess?: () => void;
}

export default function ReturnModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: Props) {
  const utils = trpc.useUtils();

  const [actualReturnDate, setActualReturnDate] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [units, setUnits] = useState<UnitReturnData[]>([]);

  const processReturnMutation =
    trpc.rental.returns.process.useMutation({
      onSuccess: () => {
        utils.rental.orders.list.invalidate();
        onSuccess?.();
        onClose();
      },
    });

  // Initialize units from order assignments when modal opens
  useEffect(() => {
    if (isOpen && order) {
      const assignments = order.unitAssignments || [];

      if (assignments.length === 0) {
        setUnits([]);
        return;
      }

      const unitEntries: UnitReturnData[] = assignments.map(
        (assignment) => ({
          unitId: assignment.rentalItemUnitId,
          unitCode: assignment.rentalItemUnit?.rentalItem?.product
            ?.name
            ? `${assignment.rentalItemUnit.rentalItem.product.name} - ${assignment.rentalItemUnit?.unitCode || 'Unit'}`
            : assignment.rentalItemUnit?.unitCode || 'Unit',
          condition: UnitCondition.GOOD,
          damageSeverity: '',
          damageNotes: '',
          afterPhotos: [],
        })
      );

      setUnits(unitEntries);
      setActualReturnDate(new Date().toISOString().slice(0, 16));
    }
  }, [isOpen, order]);

  const updateUnit = (
    index: number,
    field: keyof UnitReturnData,
    value: string | string[]
  ) => {
    const newUnits = [...units];
    newUnits[index] = { ...newUnits[index], [field]: value };
    setUnits(newUnits);
  };

  const handleAddPhoto = (index: number, base64: string) => {
    const newUnits = [...units];
    newUnits[index] = {
      ...newUnits[index],
      afterPhotos: [...newUnits[index].afterPhotos, base64],
    };
    setUnits(newUnits);
  };

  const handleRemovePhoto = (
    unitIndex: number,
    photoIndex: number
  ) => {
    const newUnits = [...units];
    newUnits[unitIndex] = {
      ...newUnits[unitIndex],
      afterPhotos: newUnits[unitIndex].afterPhotos.filter(
        (_, i) => i !== photoIndex
      ),
    };
    setUnits(newUnits);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    const unitsPayload = units.map((u) => ({
      unitId: u.unitId,
      afterPhotos: u.afterPhotos.length > 0 ? u.afterPhotos : [],
      condition: u.condition as
        | 'NEW'
        | 'GOOD'
        | 'FAIR'
        | 'NEEDS_REPAIR',
      damageSeverity: u.damageSeverity
        ? (u.damageSeverity as 'MINOR' | 'MAJOR' | 'UNUSABLE')
        : undefined,
      damageNotes: u.damageNotes || undefined,
    }));

    if (unitsPayload.length === 0) {
      toast.error('Tidak ada unit yang di-assign untuk order ini.');
      return;
    }

    await apiAction(
      () =>
        processReturnMutation.mutateAsync({
          orderId: order.id,
          actualReturnDate: new Date(actualReturnDate),
          units: unitsPayload as [
            (typeof unitsPayload)[0],
            ...(typeof unitsPayload)[0][],
          ],
        }),
      'Return berhasil diproses'
    );
  };

  if (!order) return null;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Proses Return - ${order.orderNumber}`}
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4 max-h-[70vh] overflow-y-auto"
      >
        {/* Order Summary */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Customer:</span>
            <span className="font-medium">{order.partner?.name}</span>
          </div>
        </div>

        {/* Return Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tanggal Pengembalian
          </label>
          <input
            type="datetime-local"
            value={actualReturnDate}
            onChange={(e) => setActualReturnDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
        </div>

        {/* Unit Conditions with Photo Upload */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Kondisi Unit ({units.length} unit)
          </h4>

          {units.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              Tidak ada unit yang di-assign untuk order ini.
            </div>
          ) : (
            <div className="space-y-4">
              {units.map((unit, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-50 rounded-lg space-y-3"
                >
                  <div className="font-medium text-sm">
                    {unit.unitCode}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={unit.condition}
                      onChange={(e) =>
                        updateUnit(idx, 'condition', e.target.value)
                      }
                      className="px-2 py-1.5 text-sm border rounded"
                    >
                      {CONDITION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={unit.damageSeverity}
                      onChange={(e) =>
                        updateUnit(
                          idx,
                          'damageSeverity',
                          e.target.value
                        )
                      }
                      className="px-2 py-1.5 text-sm border rounded"
                    >
                      {DAMAGE_SEVERITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {unit.damageSeverity && (
                    <textarea
                      placeholder="Catatan kerusakan..."
                      value={unit.damageNotes}
                      onChange={(e) =>
                        updateUnit(idx, 'damageNotes', e.target.value)
                      }
                      className="w-full px-2 py-1.5 text-sm border rounded"
                      rows={2}
                    />
                  )}

                  {/* Photo Upload Section */}
                  <PhotoUploader
                    photos={unit.afterPhotos}
                    onAdd={(base64) => handleAddPhoto(idx, base64)}
                    onRemove={(photoIdx) =>
                      handleRemovePhoto(idx, photoIdx)
                    }
                    size="sm"
                    label="Foto kondisi setelah dikembalikan"
                  />
                </div>
              ))}
            </div>
          )}
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
            disabled={
              processReturnMutation.isPending || units.length === 0
            }
            className="px-6 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
          >
            {processReturnMutation.isPending
              ? 'Memproses...'
              : 'Proses Return'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
