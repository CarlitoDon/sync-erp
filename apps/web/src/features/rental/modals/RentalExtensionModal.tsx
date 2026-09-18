import React, { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import FormModal from '@/components/ui/FormModal';
import Select from '@/components/ui/Select';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/input';
import { apiAction } from '@/hooks/useApiAction';
import {
  RentalPaymentMethodSchema,
  type PortableRentalOrder,
  type RentalPaymentMethod,
} from '@sync-erp/shared';
import { PAYMENT_METHOD_OPTIONS } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: PortableRentalOrder | null;
  onSuccess: () => void;
}

/**
 * T031: Partial / Full Extension modal (FR-008/FR-009).
 * Unit selection checkboxes + extra fleet fee ("Biaya Tambahan Armada").
 * Jurnal perpanjangan terposting otomatis di backend.
 */
export default function RentalExtensionModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: Props) {
  const utils = trpc.useUtils();
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [newEndDate, setNewEndDate] = useState('');
  const [additionalAmount, setAdditionalAmount] = useState<
    number | undefined
  >(undefined);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [paymentMethod, setPaymentMethod] =
    useState<RentalPaymentMethod>('BANK');
  const [paymentAccountId, setPaymentAccountId] = useState<
    string | undefined
  >();

  const { data: accounts = [] } = trpc.finance.listAccounts.useQuery(
    undefined,
    { enabled: isOpen }
  );
  const cashBankAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        if (account.isGroup) return false;
        return (
          (account.code >= '1100' && account.code <= '1199') ||
          (account.code >= '1200' && account.code <= '1299')
        );
      }),
    [accounts]
  );

  const extendMutation = trpc.rental.orders.extend.useMutation({
    onSuccess: () => {
      utils.rental.orders.list.invalidate();
      if (order) {
        utils.rental.orders.getById.invalidate({ id: order.id });
      }
      onSuccess();
      onClose();
    },
  });

  useEffect(() => {
    if (isOpen && order) {
      setSelectedItemIds(order.items.map((item) => item.id));
      const base = new Date(order.rentalEndDate);
      base.setDate(base.getDate() + 1);
      setNewEndDate(base.toISOString().slice(0, 16));
      setAdditionalAmount(undefined);
      setDeliveryFee(0);
      setPaymentMethod('BANK');
      setPaymentAccountId(undefined);
    }
    if (!isOpen) {
      setSelectedItemIds([]);
      setNewEndDate('');
      setAdditionalAmount(undefined);
      setDeliveryFee(0);
      setPaymentAccountId(undefined);
    }
  }, [isOpen, order?.id]);

  const toggleItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const isPartial =
    !!order && selectedItemIds.length < order.items.length;
  const totalEstimate = (additionalAmount ?? 0) + deliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !newEndDate || selectedItemIds.length === 0) return;

    await apiAction(
      () =>
        extendMutation.mutateAsync({
          orderId: order.id,
          newEndDate: new Date(newEndDate),
          additionalAmount: additionalAmount,
          deliveryFee,
          deliveryFeeLabel:
            deliveryFee > 0 ? 'Biaya Tambahan Armada' : undefined,
          items: selectedItemIds.map((id) => ({
            rentalOrderItemId: id,
          })),
          updateOrderDates: !isPartial,
          payment: {
            amount: totalEstimate,
            paymentMethod,
            paymentAccountId,
          },
          isPaid: true,
        }),
      isPartial
        ? 'Partial extension berhasil dicatat'
        : 'Full extension berhasil dicatat'
    );
  };

  if (!order) return null;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Perpanjangan Sewa - ${order.orderNumber}`}
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4 max-h-[70vh] overflow-y-auto"
      >
        <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
          Pilih unit yang diperpanjang. Centang semua untuk Full
          Extension, sebagian untuk Partial Extension (trip armada
          terpisah). Kosongkan biaya sewa tambahan untuk hitung
          otomatis dari tarif master.
        </div>

        <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
          {order.items.map((item) => (
            <label
              key={item.id}
              className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selectedItemIds.includes(item.id)}
                onChange={() => toggleItem(item.id)}
                className="rounded"
              />
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {item.rentalBundle?.name ||
                    item.rentalItem?.product?.name ||
                    'Item'}
                </p>
                <p className="text-xs text-gray-500">
                  {item.quantity} unit × Rp{' '}
                  {Number(item.unitPrice).toLocaleString('id-ID')}/hari
                </p>
              </div>
            </label>
          ))}
        </div>

        {isPartial && (
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800">
            Partial Extension: {selectedItemIds.length} dari{' '}
            {order.items.length} item dipilih. Isi Biaya Tambahan
            Armada untuk trip penjemputan terpisah.
          </div>
        )}

        <Input
          label="Tanggal berakhir baru *"
          type="datetime-local"
          value={newEndDate}
          onChange={(e) => setNewEndDate(e.target.value)}
          required
        />

        <CurrencyInput
          label="Biaya sewa tambahan (kosongkan = otomatis)"
          value={additionalAmount ?? 0}
          onChange={(v) =>
            setAdditionalAmount(v > 0 ? v : undefined)
          }
          min={0}
        />

        <CurrencyInput
          label="Biaya Tambahan Armada"
          value={deliveryFee}
          onChange={setDeliveryFee}
          min={0}
        />

        <Select
          label="Metode pembayaran perpanjangan"
          value={paymentMethod}
          onChange={(value) => {
            const parsed = RentalPaymentMethodSchema.safeParse(value);
            if (parsed.success) setPaymentMethod(parsed.data);
          }}
          options={PAYMENT_METHOD_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          required
        />

        <Select
          label="Akun Kas/Bank penerima"
          value={paymentAccountId ?? ''}
          onChange={(value) => setPaymentAccountId(value || undefined)}
          options={cashBankAccounts.map((account) => ({
            value: account.id,
            label: `${account.code} — ${account.name}`,
          }))}
          placeholder="Pilih akun penerimaan"
          required={paymentMethod !== RentalPaymentMethodSchema.enum.CASH}
        />

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
              extendMutation.isPending ||
              selectedItemIds.length === 0 ||
              !newEndDate
            }
            className="px-6 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
          >
            {extendMutation.isPending
              ? 'Menyimpan...'
              : isPartial
                ? 'Simpan Partial Extension'
                : 'Simpan Full Extension'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
