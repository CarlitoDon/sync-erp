import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/utils/format';
import { PaymentStatusSchema } from '@sync-erp/shared';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ActionButton,
} from '@/components/ui';
import { usePurchaseOrderCalculations } from '../hooks/usePurchaseOrderCalculations';

interface OrderFinancialsProps {
  order: Parameters<typeof usePurchaseOrderCalculations>[0];
  paymentStatus?: string | null;
}

/**
 * Card showing price breakdown: subtotal, tax, total, DP breakdown, billing summary.
 */
export function OrderFinancials({
  order,
  paymentStatus,
}: OrderFinancialsProps) {
  const calc = usePurchaseOrderCalculations(order);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">💰 Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Subtotal & Tax */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">Subtotal</span>
          <span className="font-medium">
            {formatCurrency(calc.subtotal)}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">Tax ({calc.taxRate}%)</span>
          <span className="font-medium">
            {formatCurrency(calc.taxAmount)}
          </span>
        </div>
        <hr className="my-2" />

        {/* Total */}
        <div className="flex justify-between items-center">
          <span className="font-semibold text-gray-900">
            Total Order
          </span>
          <span className="text-lg font-bold text-gray-900">
            {formatCurrency(calc.totalAmount)}
          </span>
        </div>

        {/* DP Breakdown - Show when DP is required (non-upfront) */}
        {calc.hasDpRequired && !calc.isUpfrontOrder && (
          <>
            <hr className="my-2" />
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
              Rincian Pembayaran
            </p>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">
                DP ({calc.dpPercent}%)
              </span>
              <span
                className={`font-semibold ${calc.isDpPaid ? 'text-green-600' : 'text-purple-600'}`}
              >
                {formatCurrency(calc.dpAmount)}
                {calc.isDpPaid && ' ✓'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">
                Sisa (setelah GRN)
              </span>
              <span className="font-semibold text-gray-700">
                {formatCurrency(calc.remainingAfterDp)}
              </span>
            </div>
          </>
        )}

        {/* UPFRONT Breakdown */}
        {calc.isUpfrontOrder && (
          <>
            <hr className="my-2" />
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
              Pembayaran Upfront
            </p>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">
                Full Payment (100%)
              </span>
              <span
                className={`font-semibold ${paymentStatus === PaymentStatusSchema.enum.PAID_UPFRONT ? 'text-green-600' : 'text-amber-600'}`}
              >
                {formatCurrency(calc.totalAmount)}
                {paymentStatus ===
                  PaymentStatusSchema.enum.PAID_UPFRONT && ' ✓'}
              </span>
            </div>
          </>
        )}

        {/* Billing Summary */}
        <hr className="my-2" />
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">Total Billed</span>
          <span className="font-semibold text-blue-600">
            {formatCurrency(calc.totalBilled)}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">Outstanding</span>
          <span className="font-semibold text-amber-600">
            {formatCurrency(calc.outstanding)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Info box for DP payment status with action button.
 */
interface DpPaymentInfoProps {
  hasDpRequired: boolean;
  isDpPaid: boolean;
  isUpfrontOrder: boolean;
  dpPercent: number;
  dpAmount: number;
  totalAmount: number;
  dpBillId?: string | null;
  isConfirmed?: boolean;
  onCreateDpBill?: () => void;
}

export function DpPaymentInfo({
  hasDpRequired,
  isDpPaid,
  isUpfrontOrder,
  dpPercent,
  dpAmount,
  totalAmount,
  dpBillId,
  isConfirmed,
  onCreateDpBill,
}: DpPaymentInfoProps) {
  const navigate = useNavigate();

  if (!hasDpRequired) return null;

  return (
    <div
      className={`border-l-4 p-4 rounded-lg ${
        isDpPaid
          ? 'bg-green-50 border-green-500'
          : 'bg-blue-50 border-blue-500'
      }`}
    >
      <p
        className={`font-semibold text-sm ${
          isDpPaid ? 'text-green-800' : 'text-blue-800'
        }`}
      >
        {isDpPaid
          ? '✅ Down Payment Paid'
          : '💰 Down Payment Required'}
      </p>
      <p
        className={`text-xs mt-1 ${isDpPaid ? 'text-green-700' : 'text-blue-700'}`}
      >
        {isUpfrontOrder
          ? `Full upfront: ${formatCurrency(totalAmount)}`
          : `DP ${dpPercent}%: ${formatCurrency(dpAmount)}`}
      </p>
      {!isDpPaid && !isUpfrontOrder && (
        <p className="text-xs text-blue-600 mt-1">
          Sisa: {formatCurrency(totalAmount - dpAmount)}
        </p>
      )}
      <div className="mt-3">
        {dpBillId ? (
          <ActionButton
            variant={isDpPaid ? 'secondary' : 'primary'}
            onClick={() => navigate(`/bills/${dpBillId}`)}
            className="w-full text-sm"
          >
            {isDpPaid ? 'View DP Bill' : '💳 Pay DP Bill →'}
          </ActionButton>
        ) : isConfirmed ? (
          <ActionButton
            variant="primary"
            onClick={onCreateDpBill ?? (() => {})}
            className="w-full text-sm"
          >
            Create DP Bill
          </ActionButton>
        ) : (
          <span className="text-xs text-gray-500">
            Confirm PO first to create DP Bill
          </span>
        )}
      </div>
    </div>
  );
}
