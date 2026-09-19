import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { ArrowUturnLeftIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { ReturnStatus } from '@sync-erp/shared';
import { z } from 'zod';

type DecimalLike = number | string | { toString(): string } | null | undefined;

function toNumber(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object' && 'toString' in value) {
    const parsed = Number(value.toString());
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export interface RentalReturnForView {
  id: string;
  returnedAt: Date | string;
  settlementStatus: string;
  baseRentalFee?: DecimalLike;
  lateFee?: DecimalLike;
  damageCharges?: DecimalLike;
  cleaningFee?: DecimalLike;
  otherCharges?: DecimalLike;
  totalCharges?: DecimalLike;
  depositDeduction?: DecimalLike;
  additionalChargesDue?: DecimalLike;
  depositRefund?: DecimalLike;
  settledAt?: Date | string | null;
  notes?: string | null;
}

interface RentalReturnCardProps {
  returnRecord?: RentalReturnForView | null;
}

interface ParsedReturnNotes {
  damagePaid?: number;
  textNotes?: string;
}

const ReturnNotesSchema = z.object({
  damagePaid: z
    .union([z.number(), z.string()])
    .transform((val) => {
      if (typeof val === 'number') return val;
      const num = Number(val);
      return Number.isNaN(num) ? undefined : num;
    })
    .optional(),
  notes: z.string().optional(),
  text: z.string().optional(),
});

function parseReturnNotes(rawNotes?: string | null): ParsedReturnNotes {
  if (!rawNotes) return {};
  try {
    const parsed: unknown = JSON.parse(rawNotes);
    const result = ReturnNotesSchema.safeParse(parsed);
    if (result.success) {
      return {
        damagePaid: result.data.damagePaid,
        textNotes: result.data.notes ?? result.data.text,
      };
    }
  } catch {
    // Not valid JSON, treated as plain text notes
  }
  return { textNotes: rawNotes };
}

export function RentalReturnCard({ returnRecord }: RentalReturnCardProps) {
  if (!returnRecord) return null;

  const isSettled = returnRecord.settlementStatus === ReturnStatus.SETTLED;
  const parsedNotes = parseReturnNotes(returnRecord.notes);
  const damagePaid = parsedNotes.damagePaid;
  const textNotes = parsedNotes.textNotes;

  const lateFee = toNumber(returnRecord.lateFee);
  const damageCharges = toNumber(returnRecord.damageCharges);
  const cleaningFee = toNumber(returnRecord.cleaningFee);
  const totalCharges = toNumber(returnRecord.totalCharges);
  const depositDeduction = toNumber(returnRecord.depositDeduction);
  const depositRefund = toNumber(returnRecord.depositRefund);
  const additionalChargesDue = toNumber(returnRecord.additionalChargesDue);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ArrowUturnLeftIcon className="w-5 h-5 text-purple-600" />
            Pengembalian & Settlement
          </CardTitle>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isSettled
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {isSettled ? (
              <>
                <CheckCircleIcon className="w-3.5 h-3.5" />
                LUNAS (SETTLED)
              </>
            ) : (
              <>
                <ExclamationCircleIcon className="w-3.5 h-3.5" />
                DRAFT / BELUM LUNAS
              </>
            )}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-4 pb-3 border-b border-gray-100">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">
              Tanggal Dikembalikan
            </p>
            <p className="font-medium text-gray-900 mt-0.5">
              {formatDateTime(returnRecord.returnedAt)}
            </p>
          </div>
          {returnRecord.settledAt && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">
                Tanggal Selesai
              </p>
              <p className="font-medium text-gray-900 mt-0.5">
                {formatDateTime(returnRecord.settledAt)}
              </p>
            </div>
          )}
        </div>

        {/* Biaya Tambahan & Denda */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Rincian Biaya Tambahan
          </p>
          {lateFee > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Denda Keterlambatan</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(lateFee)}
              </span>
            </div>
          )}
          {damageCharges > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Biaya Kerusakan Unit</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(damageCharges)}
              </span>
            </div>
          )}
          {cleaningFee > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Biaya Pembersihan</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(cleaningFee)}
              </span>
            </div>
          )}
          <div className="flex justify-between font-semibold pt-1 border-t border-gray-100 text-gray-900">
            <span>Total Tagihan Return</span>
            <span>{formatCurrency(totalCharges)}</span>
          </div>
        </div>

        {/* Deposit & Pelunasan */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Alokasi Deposit & Sisa
          </p>
          {depositDeduction > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Deposit Dipotong</span>
              <span className="font-medium text-red-600">
                -{formatCurrency(depositDeduction)}
              </span>
            </div>
          )}
          {depositRefund > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Deposit Dikembalikan</span>
              <span className="font-medium text-green-600">
                {formatCurrency(depositRefund)}
              </span>
            </div>
          )}
          {additionalChargesDue > 0 && (
            <div className="flex justify-between text-gray-900 font-semibold bg-red-50 p-2 rounded">
              <span className="text-red-700">Sisa Tagihan Kurang Bayar</span>
              <span className="text-red-700">
                {formatCurrency(additionalChargesDue)}
              </span>
            </div>
          )}
        </div>

        {/* Notes & Damage Payment Badge */}
        {(damagePaid !== undefined || textNotes) && (
          <div className="pt-3 border-t border-gray-100 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Catatan & Bukti Return
            </p>
            {damagePaid !== undefined && damagePaid > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 text-green-800 rounded-md text-xs font-medium">
                <span>Denda Kerusakan Dibayar Tunai/Transfer:</span>
                <span className="font-bold">{formatCurrency(damagePaid)}</span>
              </div>
            )}
            {textNotes && (
              <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                {textNotes}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
