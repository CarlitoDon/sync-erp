import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import FormModal from '@/components/ui/FormModal';
import { apiAction } from '@/hooks/useApiAction';
import { UnitStatus } from '@sync-erp/shared';

const STATUS_OPTIONS = [
  {
    value: UnitStatus.AVAILABLE,
    label: 'Tersedia',
    color: 'bg-green-100 text-green-800',
    requiresReason: false,
  },
  {
    value: UnitStatus.CLEANING,
    label: 'Pembersihan',
    color: 'bg-orange-100 text-orange-800',
    requiresReason: false,
  },
  {
    value: UnitStatus.MAINTENANCE,
    label: 'Perbaikan',
    color: 'bg-red-100 text-red-800',
    requiresReason: true,
  },
  {
    value: UnitStatus.RETIRED,
    label: 'Pensiun',
    color: 'bg-gray-100 text-gray-800',
    requiresReason: true,
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  unit: {
    id: string;
    unitCode: string;
    status: string;
    condition: string;
  } | null;
  onSuccess: () => void;
}

export default function UnitStatusModal({
  isOpen,
  onClose,
  unit,
  onSuccess,
}: Props) {
  const utils = trpc.useUtils();

  const updateStatusMutation =
    trpc.rental.items.updateUnitStatus.useMutation({
      onSuccess: () => {
        utils.rental.items.list.invalidate();
        onSuccess();
        onClose();
      },
    });

  const [newStatus, setNewStatus] = useState<string>(
    unit?.status || UnitStatus.AVAILABLE
  );
  const [reason, setReason] = useState('');

  // Reset form when unit changes
  React.useEffect(() => {
    if (unit) {
      setNewStatus(unit.status);
      setReason('');
    }
  }, [unit]);

  const selectedOption = STATUS_OPTIONS.find(
    (opt) => opt.value === newStatus
  );
  const requiresReason = selectedOption?.requiresReason || false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit) return;

    if (requiresReason && reason.length < 5) {
      return; // Validation handled by form
    }

    const payload = {
      unitId: unit.id,
      status: newStatus as
        | 'AVAILABLE'
        | 'RESERVED'
        | 'RENTED'
        | 'RETURNED'
        | 'CLEANING'
        | 'MAINTENANCE'
        | 'RETIRED',
      reason: requiresReason ? reason : undefined,
    };

    await apiAction(
      () => updateStatusMutation.mutateAsync(payload),
      'Status unit berhasil diubah'
    );
  };

  if (!unit) return null;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Ubah Status Unit - ${unit.unitCode}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Status */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Status Saat Ini:</span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                STATUS_OPTIONS.find((o) => o.value === unit.status)
                  ?.color || 'bg-gray-100'
              }`}
            >
              {STATUS_OPTIONS.find((o) => o.value === unit.status)
                ?.label || unit.status}
            </span>
          </div>
        </div>

        {/* Status Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status Baru
          </label>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setNewStatus(opt.value)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  newStatus === opt.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{opt.label}</span>
                  {newStatus === opt.value && (
                    <span className="w-2 h-2 rounded-full bg-primary-600" />
                  )}
                </div>
                {opt.requiresReason && (
                  <span className="text-xs text-gray-500">
                    Perlu alasan
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Reason Input */}
        {requiresReason && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alasan *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                newStatus === UnitStatus.MAINTENANCE
                  ? 'Jelaskan kerusakan atau perbaikan yang diperlukan...'
                  : 'Jelaskan alasan pensiun unit ini...'
              }
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              required
              minLength={5}
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimal 5 karakter
            </p>
          </div>
        )}

        {/* Warning for Retired */}
        {newStatus === UnitStatus.RETIRED && (
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ Unit yang sudah pensiun tidak bisa disewakan lagi.
              Pastikan keputusan ini sudah benar.
            </p>
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
            disabled={
              updateStatusMutation.isPending ||
              newStatus === unit.status ||
              (requiresReason && reason.length < 5)
            }
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {updateStatusMutation.isPending
              ? 'Menyimpan...'
              : 'Simpan'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
