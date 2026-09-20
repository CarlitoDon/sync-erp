import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  ActionButton,
} from '@/components/ui';
import { CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { formatCurrency, formatDateTime } from '@/utils/format';
import {
  evaluateRentalPaymentStatus,
  RentalPaymentStatusInput,
  DecimalLike,
} from '@sync-erp/shared';
import { RentalOrderPermissions } from '../hooks/useRentalOrderPermissions';

interface RentalPaymentStatusCardProps {
  order?: RentalPaymentStatusInput | null;
  rentalPaymentStatus?: string | null;
  status?: string;
  totalAmount?: DecimalLike;
  depositAmount?: DecimalLike;
  paymentClaimedAt?: Date | string | null;
  paymentConfirmedAt?: Date | string | null;
  paymentReference?: string | null;
  paymentFailReason?: string | null;
  permissions: RentalOrderPermissions;
  onVerifyPayment: () => void;
}

export function RentalPaymentStatusCard({
  order,
  rentalPaymentStatus,
  status,
  totalAmount,
  depositAmount,
  paymentClaimedAt,
  paymentConfirmedAt,
  paymentReference,
  paymentFailReason,
  permissions,
  onVerifyPayment,
}: RentalPaymentStatusCardProps) {
  const orderInput: RentalPaymentStatusInput = order ?? {
    status: status ?? '',
    rentalPaymentStatus,
    totalAmount,
    depositAmount,
  };

  const paymentInfo = evaluateRentalPaymentStatus(orderInput);

  // If no order or payment status info is available at all, hide card
  if (!order && !rentalPaymentStatus && !status) return null;

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
            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${paymentInfo.badgeClass}`}
          >
            {paymentInfo.label}
          </span>
        </div>

        {paymentInfo.status === 'DP_TERBAYAR' && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Sisa Tagihan</span>
            <span className="font-medium text-amber-700">
              {formatCurrency(paymentInfo.remainingAmount)}
            </span>
          </div>
        )}

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
