import React, { useState, useMemo, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import FormModal from '@/components/ui/FormModal';
import Select from '@/components/ui/Select';
import { Input } from '@/components/ui/input';
import { apiAction } from '@/hooks/useApiAction';
import { useBillingFeatures } from '@/hooks/useBillingFeatures';
import type { RentalOrderWithRelations } from '@sync-erp/shared';
import {
  ReleaseRentalOrderSchema,
  RentalPaymentMethodSchema,
  type RentalPaymentMethod,
} from '@sync-erp/shared';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { PhotoUploader } from '../components';
import { CONDITION_OPTIONS, PAYMENT_METHOD_OPTIONS } from '../constants';

interface UnitAssignment {
  unitId: string;
  unitCode: string;
  condition: string;
  productName: string;
  beforePhotos: string[];
  notes: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: RentalOrderWithRelations | null;
  onSuccess: () => void;
}

/**
 * UnitAssignmentModal - Serah Terima Unit
 *
 * Modal ini digunakan untuk menyerahkan unit ke customer setelah order CONFIRMED.
 * Unit yang ditampilkan adalah unit yang sudah di-reserve saat konfirmasi order.
 * User hanya perlu menambah foto kondisi dan klik serahkan.
 */
export default function UnitAssignmentModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: Props) {
  const utils = trpc.useUtils();
  const { mediaAccess } = useBillingFeatures();

  const releaseMutation = trpc.rental.orders.release.useMutation({
    onSuccess: () => {
      utils.rental.orders.list.invalidate();
      utils.rental.orders.getById.invalidate();
      onSuccess();
      onClose();
    },
  });

  // Get reserved units from order (already assigned during confirm)
  const reservedUnits = useMemo(() => {
    if (!order?.unitAssignments) return [];
    return order.unitAssignments
      .filter((a) => a.rentalItemUnit)
      .map((assignment) => ({
        unitId: assignment.rentalItemUnit!.id,
        unitCode: assignment.rentalItemUnit!.unitCode,
        condition: assignment.rentalItemUnit!.condition,
        productName:
          assignment.rentalItemUnit?.rentalItem?.product?.name || 'Unknown',
      }));
  }, [order]);

  // State for photo uploads per unit
  const [assignments, setAssignments] = useState<UnitAssignment[]>([]);
  const [skipPhotoCheck, setSkipPhotoCheck] = useState(true);

  // T020: Integrated 70% settlement payment inputs (FR-005)
  const totalExpected = useMemo(() => {
    if (!order) return 0;
    return Number(order.subtotal ?? 0) + Number(order.deliveryFee ?? 0);
  }, [order]);
  const depositPaid = useMemo(
    () => (order ? Number(order.depositAmount ?? 0) : 0),
    [order]
  );
  const defaultSettlement = useMemo(
    () =>
      Math.max(
        0,
        totalExpected - Math.min(depositPaid, totalExpected)
      ),
    [totalExpected, depositPaid]
  );
  const [settlementAmount, setSettlementAmount] = useState(0);
  const [settlementMethod, setSettlementMethod] =
    useState<RentalPaymentMethod>('CASH');
  const [settlementAccountId, setSettlementAccountId] = useState<
    string | undefined
  >();
  const [settlementReference, setSettlementReference] = useState('');

  const { data: accounts = [] } = trpc.finance.listAccounts.useQuery(
    undefined,
    { enabled: isOpen }
  );
  const cashBankAccounts = useMemo(() => {
    const headers = new Set(['1100', '1200', '1210']);
    return accounts.filter((account) => {
      if (account.isGroup || headers.has(account.code)) return false;
      return (
        (account.code >= '1100' && account.code <= '1199') ||
        (account.code >= '1200' && account.code <= '1299')
      );
    });
  }, [accounts]);

  // Initialize assignments from reserved units when modal opens
  useEffect(() => {
    if (isOpen && reservedUnits.length > 0 && assignments.length === 0) {
      setAssignments(
        reservedUnits.map((u) => ({
          unitId: u.unitId,
          unitCode: u.unitCode,
          condition: u.condition,
          productName: u.productName,
          beforePhotos: [],
          notes: '',
        }))
      );
    }
    // Reset when modal closes
    if (!isOpen) {
      setAssignments([]);
      setSettlementAmount(0);
      setSettlementMethod('CASH');
      setSettlementAccountId(undefined);
      setSettlementReference('');
    }
  }, [isOpen, reservedUnits]);

  // Prefill settlement amount when order loads
  useEffect(() => {
    if (isOpen && order) {
      setSettlementAmount(defaultSettlement);
    }
  }, [isOpen, order?.id, defaultSettlement]);

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
                (_, idx) => idx !== photoIndex
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
      skipPhotoCheck,
      unitAssignments: assignments.map((a) => ({
        unitId: a.unitId,
        beforePhotos: a.beforePhotos,
        condition: a.condition as 'NEW' | 'GOOD' | 'FAIR' | 'NEEDS_REPAIR',
        notes: a.notes || undefined,
      })),
      payment: {
        settlementAmount,
        paymentMethod: settlementMethod,
        paymentAccountId: settlementAccountId,
        reference: settlementReference || undefined,
      },
    };

    const parsed = ReleaseRentalOrderSchema.safeParse(payload);
    if (!parsed.success) {
      const { toast } = await import('react-hot-toast');
      toast.error(
        parsed.error.issues[0]?.message ?? 'Input pelunasan tidak valid'
      );
      return;
    }

    await apiAction(
      () => releaseMutation.mutateAsync(payload),
      'Unit berhasil diserahkan ke customer'
    );
  };

  if (!order) return null;

  // If no reserved units, show error
  if (reservedUnits.length === 0) {
    return (
      <FormModal
        isOpen={isOpen}
        onClose={onClose}
        title={`Serah Terima Unit - ${order.orderNumber}`}
      >
        <div className="p-6 text-center">
          <p className="text-red-600 mb-4">
            Tidak ada unit yang ter-reserve untuk order ini.
          </p>
          <p className="text-gray-500 text-sm">
            Pastikan order sudah dikonfirmasi dan unit sudah dipilih.
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Tutup
          </button>
        </div>
      </FormModal>
    );
  }

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
            Unit yang akan diserahkan:{' '}
            <span className="font-semibold">{reservedUnits.length} unit</span>
          </div>
        </div>

        {/* Reserved Units - Ready for Release */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Unit Ter-reserve ({reservedUnits.length})
            {mediaAccess ? ' - Tambah Foto Kondisi' : ''}
          </h4>
          <div className="space-y-3">
            {assignments.map((assignment) => {
              const conditionOption = CONDITION_OPTIONS.find(
                (c) => c.value === assignment.condition
              );

              return (
                <div
                  key={assignment.unitId}
                  className="p-4 bg-green-50 border border-green-200 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-mono font-semibold text-lg">
                        {assignment.unitCode}
                      </span>
                      <span className="ml-2 text-sm text-gray-500">
                        {assignment.productName}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${conditionOption?.color || 'bg-gray-100'}`}
                    >
                      {conditionOption?.label || assignment.condition}
                    </span>
                  </div>

                  {/* Photo Upload Section */}
                  <PhotoUploader
                    photos={assignment.beforePhotos}
                    onAdd={(base64) => handleAddPhoto(assignment.unitId, base64)}
                    onRemove={(photoIdx) =>
                      handleRemovePhoto(assignment.unitId, photoIdx)
                    }
                    label="Tambah foto kondisi unit sebelum diserahkan"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* T020: Integrated 70% settlement payment (FR-005) */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <h4 className="font-medium text-blue-900">
            Pelunasan Sisa Sewa (±70%) di Lokasi
          </h4>
          <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
            <span>
              Total sewa + ongkir: Rp{' '}
              {totalExpected.toLocaleString('id-ID')}
            </span>
            <span>DP diterima: Rp {depositPaid.toLocaleString('id-ID')}</span>
          </div>
          <CurrencyInput
            label="Nominal pelunasan"
            value={settlementAmount}
            onChange={setSettlementAmount}
            min={0}
            required
          />
          <Select
            label="Metode pembayaran"
            value={settlementMethod}
            onChange={(value) => {
              const parsed = RentalPaymentMethodSchema.safeParse(value);
              if (parsed.success) setSettlementMethod(parsed.data);
            }}
            options={PAYMENT_METHOD_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            required
          />
          <Select
            label="Akun Kas/Bank tujuan"
            value={settlementAccountId ?? ''}
            onChange={(value) =>
              setSettlementAccountId(value || undefined)
            }
            options={cashBankAccounts.map((account) => ({
              value: account.id,
              label: `${account.code} — ${account.name}`,
            }))}
            placeholder="Pilih akun penerimaan"
            required={settlementMethod !== RentalPaymentMethodSchema.enum.CASH}
          />
          <Input
            label="Referensi pembayaran"
            value={settlementReference}
            onChange={(event) =>
              setSettlementReference(event.target.value)
            }
            placeholder="No. transfer / bukti QRIS (opsional)"
          />
          <p className="text-xs text-blue-700">
            Order otomatis menjadi ACTIVE dan chip pembayaran menjadi
            Lunas setelah serah terima. Jurnal pendapatan sewa
            terposting otomatis.
          </p>
        </div>

        {/* Skip Photo Checkbox */}
        <div className="flex items-center gap-2 pt-3 border-t">
          <input
            type="checkbox"
            id="skipPhotoCheck"
            checked={skipPhotoCheck}
            onChange={(e) => setSkipPhotoCheck(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label
            htmlFor="skipPhotoCheck"
            className="text-xs text-gray-600 cursor-pointer select-none"
          >
            Serahkan langsung tanpa wajib lampiran foto
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={releaseMutation.isPending}
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
