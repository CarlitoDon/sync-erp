import ActionButton from '@/components/ui/ActionButton';
import {
  OrderStatusSchema,
  PaymentTermsSchema,
  PaymentStatusSchema,
  InvoiceStatusSchema,
} from '@sync-erp/shared';

interface PurchaseOrder {
  id: string;
  status: string;
  paymentTerms?: string | null;
  paymentStatus?: string | null;
  invoices?: {
    id: string;
    status: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    balance: any; // Handle Prisma Decimal
  }[];
}

interface PurchaseOrderActionsProps {
  order: PurchaseOrder;
  onConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
  onReceiveGoods?: (id: string) => void;
  onCreateBill?: (id: string) => void;
  onViewBill?: (billId: string) => void;
  // eslint-disable-next-line
  layout?: 'list' | 'detail';
}

export default function PurchaseOrderActions({
  order,
  onConfirm,
  onCancel,
  onReceiveGoods,
  onCreateBill,
  onViewBill,
  layout = 'list',
}: PurchaseOrderActionsProps) {
  // Helper for Bill Status Badge (copied from List component logic)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getBillStatusBadge = (status: string, balance: any) => {
    // Handle Prisma Decimal or number/string
    const numBalance =
    typeof balance === 'object' &&
    balance !== null &&
    'toNumber' in balance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (balance as any).toNumber()
        : Number(balance);
    const formatCompact = (val: number) => {
      if (val >= 1000000000)
        return `${(val / 1000000000).toFixed(1)}B`;
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
      return val.toFixed(0);
    };

    switch (status) {
      case InvoiceStatusSchema.enum.PAID:
        return {
          color: 'bg-green-100 text-green-800',
          label: '✓ Paid',
        };
      case InvoiceStatusSchema.enum.POSTED:
        return {
          color: 'bg-yellow-100 text-yellow-800',
          label:
            numBalance > 0
              ? `○ Rp ${formatCompact(numBalance)}`
              : '○ Posted',
        };
      case InvoiceStatusSchema.enum.VOID:
        return { color: 'bg-red-100 text-red-800', label: '✕ Void' };
      default:
        return {
          color: 'bg-gray-100 text-gray-600',
          label: '◌ Draft',
        };
    }
  };

  const isDraft = order.status === OrderStatusSchema.enum.DRAFT;
  const isConfirmed =
    order.status === OrderStatusSchema.enum.CONFIRMED;
  const isPartiallyReceived =
    order.status === OrderStatusSchema.enum.PARTIALLY_RECEIVED;
  const isReceived = order.status === OrderStatusSchema.enum.RECEIVED;
  const isCompleted =
    order.status === OrderStatusSchema.enum.COMPLETED;

  const isUpfront =
    order.paymentTerms === PaymentTermsSchema.enum.UPFRONT;
  const isPaidUpfront =
    order.paymentStatus === PaymentStatusSchema.enum.PAID_UPFRONT;

  // Logic: Block receive if UPFRONT and not PAID_UPFRONT
  const canReceiveGoods =
    (isConfirmed || isPartiallyReceived) &&
    !(isUpfront && !isPaidUpfront);

  const canCreateBill =
    (isReceived || isPartiallyReceived || isCompleted) &&
    (!order.invoices || order.invoices.length === 0);

  const hasBill = order.invoices && order.invoices.length > 0;
  const firstBill = hasBill ? order.invoices![0] : null;

  return (
    <div
      className={
        layout === 'list' ? 'space-x-2' : 'flex flex-wrap gap-3'
      }
    >
      {/* Confirm & Cancel */}
      {isDraft && (
        <>
          {onConfirm && (
            <ActionButton
              onClick={() => onConfirm(order.id)}
              variant="primary"
            >
              Confirm
            </ActionButton>
          )}
          {onCancel && (
            <ActionButton
              onClick={() => onCancel(order.id)}
              variant="danger"
            >
              Cancel
            </ActionButton>
          )}
        </>
      )}

      {/* Receive Goods */}
      {canReceiveGoods && onReceiveGoods && (
        <ActionButton
          onClick={() => onReceiveGoods(order.id)}
          variant="success"
        >
          Receive Goods
        </ActionButton>
      )}

      {/* Create Bill */}
      {canCreateBill && onCreateBill && (
        <ActionButton
          onClick={() => onCreateBill(order.id)}
          variant="primary"
        >
          Create Bill
        </ActionButton>
      )}

      {/* View Bill */}
      {hasBill && onViewBill && firstBill && (
        <div
          className={
            layout === 'list'
              ? 'flex flex-col items-end gap-1 inline-flex align-middle'
              : 'contents'
          }
        >
          <ActionButton
            onClick={() => onViewBill(firstBill.id)}
            variant="secondary"
          >
            View Bill
          </ActionButton>
          {layout === 'list' && (
            <span
              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                getBillStatusBadge(
                  firstBill.status,
                  Number(firstBill.balance)
                ).color
              }`}
            >
              {
                getBillStatusBadge(
                  firstBill.status,
                  Number(firstBill.balance)
                ).label
              }
            </span>
          )}
        </div>
      )}
    </div>
  );
}
