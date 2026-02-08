import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  ActionButton,
} from '@/components/ui';
import { CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { formatDateTime } from '@/utils/format';
import {
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
} from '../constants';
import { RentalOrderPermissions } from '../hooks/useRentalOrderPermissions';

interface RentalPaymentStatusCardProps {
  rentalPaymentStatus?: string | null;
  paymentClaimedAt?: Date | string | null;
  paymentConfirmedAt?: Date | string | null;
  paymentReference?: string | null;
  paymentFailReason?: string | null;
  permissions: RentalOrderPermissions;
  onVerifyPayment: () => void;
}

export function RentalPaymentStatusCard({
  rentalPaymentStatus,
  paymentClaimedAt,
  paymentConfirmedAt,
  paymentReference,
  paymentFailReason,
  permissions,
  onVerifyPayment,
}: RentalPaymentStatusCardProps) {
  if (!rentalPaymentStatus) return null;

  return (
    <Card
      className={
        permissions.isAwaitingPaymentVerification
          ? 'ring-2 ring-yellow-400'
          : ''
      }
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CurrencyDollarIcon className="w-5 h-5" />
          Status Pembayaran
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Status</span>
          <span
            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${PAYMENT_STATUS_COLORS[rentalPaymentStatus as keyof typeof PAYMENT_STATUS_COLORS] || 'bg-gray-100 text-gray-700'}`}
          >
            {PAYMENT_STATUS_LABELS[
              rentalPaymentStatus as keyof typeof PAYMENT_STATUS_LABELS
            ] || rentalPaymentStatus}
          </span>
        </div>

        {paymentClaimedAt && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Diklaim</span>
            <span>{formatDateTime(paymentClaimedAt)}</span>
          </div>
        )}

        {paymentConfirmedAt && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Dikonfirmasi</span>
            <span>{formatDateTime(paymentConfirmedAt)}</span>
          </div>
        )}

        {paymentReference && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Referensi</span>
            <span className="font-mono text-xs">
              {paymentReference}
            </span>
          </div>
        )}

        {paymentFailReason && (
          <div className="p-2 bg-red-50 rounded text-sm text-red-700">
            <span className="font-medium">Alasan gagal:</span>{' '}
            {paymentFailReason}
          </div>
        )}

        {permissions.canVerifyPayment && (
          <ActionButton
            variant="primary"
            className="w-full mt-2"
            onClick={onVerifyPayment}
          >
            Verifikasi Pembayaran
          </ActionButton>
        )}
      </CardContent>
    </Card>
  );
}
