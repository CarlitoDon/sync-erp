import React, { useState, useEffect, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import FormModal from '@/components/ui/FormModal';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import Select from '@/components/ui/Select';
import { Input } from '@/components/ui/input';
import { apiAction } from '@/hooks/useApiAction';
import {
  RecordSettlementSchema,
  type RentalOrderWithRelations,
} from '@sync-erp/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: RentalOrderWithRelations | null;
  onSuccess: () => void;
}

export default function SettlementModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: Props) {
  const { data: paymentMethods = [] } = trpc.paymentMethod.list.useQuery(
    undefined,
    { enabled: isOpen }
  );

  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [settlementAmount, setSettlementAmount] = useState<number>(0);
  const [reference, setReference] = useState<string>('');

  const recordSettlementMutation =
    trpc.rental.orders.recordSettlement.useMutation();

  const totalAmount = useMemo(() => {
    if (!order) return 0;
    return Number(
      order.totalAmount ??
        Number(order.subtotal ?? 0) +
          Number(order.deliveryFee ?? 0) -
          Number(order.discountAmount ?? 0)
    );
  }, [order]);

  const depositPaid = useMemo(() => {
    if (!order) return 0;
    return Number(order.depositAmount ?? 0);
  }, [order]);

  const remainingBalance = useMemo(() => {
    return Math.max(0, totalAmount - depositPaid);
  }, [totalAmount, depositPaid]);

  useEffect(() => {
    if (isOpen && order) {
      setSettlementAmount(Math.max(0, totalAmount - depositPaid));
      setReference('');

      if (paymentMethods.length > 0) {
        const defaultMethod =
          paymentMethods.find((pm) => pm.isDefault) || paymentMethods[0];
        if (defaultMethod) {
          setPaymentMethodId(defaultMethod.id);
        }
      }
    }
    if (!isOpen) {
      setPaymentMethodId('');
      setSettlementAmount(0);
      setReference('');
    }
  }, [isOpen, order, totalAmount, depositPaid, paymentMethods]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    const payload = {
      orderId: order.id,
      paymentMethodId,
      settlementAmount,
      reference: reference.trim() || undefined,
    };

    const parsed = RecordSettlementSchema.safeParse(payload);
    if (!parsed.success) {
      const { toast } = await import('react-hot-toast');
      toast.error(
        parsed.error.issues[0]?.message ?? 'Input pelunasan tidak valid'
      );
      return;
    }

    await apiAction(
      () => recordSettlementMutation.mutateAsync(parsed.data),
      'Pelunasan berhasil dicatat'
    );
    onSuccess();
    onClose();
  };

  if (!order) return null;

  const paymentMethodOptions = paymentMethods.map((pm) => ({
    value: pm.id,
    label:
      pm.name +
      (pm.account ? ` (${pm.account.code} — ${pm.account.name})` : ''),
  }));

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Catat Pelunasan - ${order.orderNumber}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Header Summary */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-medium text-slate-500 mb-1">
            Customer: <span className="text-slate-800">{order.partner?.name ?? '-'}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-200">
            <div>
              <div className="text-xs text-slate-500">Total Sewa</div>
              <div className="text-sm font-semibold text-slate-900">
                Rp {totalAmount.toLocaleString('id-ID')}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">DP Terbayar</div>
              <div className="text-sm font-semibold text-emerald-700">
                Rp {depositPaid.toLocaleString('id-ID')}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Sisa Tagihan</div>
              <div className="text-sm font-semibold text-rose-700">
                Rp {remainingBalance.toLocaleString('id-ID')}
              </div>
            </div>
          </div>
        </div>

        {/* Nominal Pelunasan */}
        <CurrencyInput
          label="Nominal Pelunasan"
          value={settlementAmount}
          onChange={setSettlementAmount}
          min={0}
          required
        />

        {/* Metode Pembayaran */}
        <Select
          label="Metode Pembayaran"
          value={paymentMethodId}
          onChange={setPaymentMethodId}
          options={paymentMethodOptions}
          placeholder="Pilih metode pembayaran"
          required
        />

        {/* Referensi Pembayaran */}
        <Input
          label="Referensi Pembayaran"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="No. transfer / bukti transaksi (opsional)"
        />

        {/* Info Note */}
        <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-200">
          Setelah pelunasan dicatat, status pembayaran otomatis menjadi Lunas dan jurnal pelunasan sewa terposting secara otomatis.
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={recordSettlementMutation.isPending || !paymentMethodId}
            className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
          >
            {recordSettlementMutation.isPending ? 'Memproses...' : 'Catat Pelunasan'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
