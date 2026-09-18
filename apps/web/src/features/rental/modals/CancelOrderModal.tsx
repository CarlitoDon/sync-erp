import React, { useEffect, useMemo, useState } from 'react';
import FormModal from '@/components/ui/FormModal';
import Select from '@/components/ui/Select';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';
import {
  RentalPaymentMethodSchema,
  type RentalPaymentMethod,
} from '@sync-erp/shared';
import { PAYMENT_METHOD_OPTIONS } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  onSuccess?: () => void;
}

export default function CancelOrderModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  onSuccess,
}: Props) {
  const utils = trpc.useUtils();
  const [reason, setReason] = useState('');

  // T017: Cancellation refund orchestration (FR-015/FR-020).
  // Unit RESERVED dilepas ke AVAILABLE, refund DP memposting jurnal
  // pembalik (Debet Uang Muka 2200, Kredit Kas/Bank).
  const { data: order } = trpc.rental.orders.getById.useQuery(
    { id: orderId },
    { enabled: isOpen && !!orderId }
  );
  const depositPaid = useMemo(
    () => (order ? Number(order.depositAmount ?? 0) : 0),
    [order]
  );
  const [refundEnabled, setRefundEnabled] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundMethod, setRefundMethod] =
    useState<RentalPaymentMethod>('BANK');
  const [refundAccountId, setRefundAccountId] = useState<
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

  useEffect(() => {
    if (isOpen) {
      setRefundEnabled(depositPaid > 0);
      setRefundAmount(depositPaid);
      setRefundMethod('BANK');
      setRefundAccountId(undefined);
    }
    if (!isOpen) {
      setReason('');
      setRefundEnabled(false);
      setRefundAmount(0);
      setRefundAccountId(undefined);
    }
  }, [isOpen, depositPaid]);

  const cancelMutation = trpc.rental.orders.cancel.useMutation({
    onSuccess: () => {
      utils.rental.orders.list.invalidate();
      utils.rental.orders.getById.invalidate({ id: orderId });
      onSuccess?.();
      handleClose();
    },
  });

  const handleClose = () => {
    setReason('');
    setRefundEnabled(false);
    setRefundAmount(0);
    setRefundAccountId(undefined);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    if (reason.trim().length < 5) return;

    await apiAction(
      () =>
        cancelMutation.mutateAsync({
          orderId,
          reason: reason.trim(),
          refundPayment:
            refundEnabled && refundAmount > 0
              ? {
                  amount: refundAmount,
                  paymentAccountId: refundAccountId,
                  paymentMethod: refundMethod,
                }
              : undefined,
        }),
      'Order dibatalkan'
    );
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Batalkan Order ${orderNumber}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            Order yang dibatalkan tidak dapat dikembalikan. Unit
            RESERVED dilepas kembali menjadi AVAILABLE. Pastikan Anda
            yakin sebelum melanjutkan.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alasan Pembatalan *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: Customer membatalkan order..."
            className="w-full px-3 py-2 border rounded-lg"
            rows={3}
            required
            autoFocus
          />
          {reason.trim().length > 0 && reason.trim().length < 5 && (
            <p className="text-xs text-red-600 mt-1">
              Alasan minimal 5 karakter.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="refundDp"
              checked={refundEnabled}
              onChange={(e) => setRefundEnabled(e.target.checked)}
              className="rounded"
            />
            <label
              htmlFor="refundDp"
              className="text-sm font-medium text-gray-700"
            >
              Refund DP ke customer
              {depositPaid > 0 &&
                ` (DP tercatat Rp ${depositPaid.toLocaleString('id-ID')})`}
            </label>
          </div>
          {refundEnabled && (
            <>
              <CurrencyInput
                label="Nominal refund"
                value={refundAmount}
                onChange={setRefundAmount}
                min={0}
                max={depositPaid > 0 ? depositPaid : undefined}
                required
              />
              <Select
                label="Metode refund"
                value={refundMethod}
                onChange={(value) => {
                  const parsed =
                    RentalPaymentMethodSchema.safeParse(value);
                  if (parsed.success) setRefundMethod(parsed.data);
                }}
                options={PAYMENT_METHOD_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
              <Select
                label="Akun Kas/Bank sumber refund"
                value={refundAccountId ?? ''}
                onChange={(value) =>
                  setRefundAccountId(value || undefined)
                }
                options={cashBankAccounts.map((account) => ({
                  value: account.id,
                  label: `${account.code} — ${account.name}`,
                }))}
                placeholder="Pilih akun sumber"
                required={refundMethod !== RentalPaymentMethodSchema.enum.CASH}
              />
              <p className="text-xs text-gray-500">
                Jurnal pembalik otomatis: Debet Uang Muka Sewa (2200),
                Kredit Kas/Bank.
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-gray-100 rounded-lg"
          >
            Kembali
          </button>
          <button
            type="submit"
            disabled={
              cancelMutation.isPending || reason.trim().length < 5
            }
            className="px-6 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50 hover:bg-red-700"
          >
            {cancelMutation.isPending
              ? 'Memproses...'
              : 'Batalkan Order'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
