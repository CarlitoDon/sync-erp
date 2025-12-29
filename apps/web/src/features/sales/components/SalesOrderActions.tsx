import ActionButton from '@/components/ui/ActionButton';
import {
  OrderStatusSchema,
  PaymentTermsSchema,
  PaymentStatusSchema,
  InvoiceStatusSchema,
} from '@sync-erp/shared';

// Type for Prisma Decimal that can be number, string, or Decimal object
type DecimalLike = number | string | { toNumber(): number } | null;

interface SalesOrder {
  id: string;
  status: string;
  paymentTerms?: string | null;
  paymentStatus?: string | null;
  dpAmount?: DecimalLike;
  paidAmount?: DecimalLike;
  invoices?: {
    id: string;
    status: string;
    notes?: string | null;
    balance: DecimalLike;
  }[];
}

interface SalesOrderActionsProps {
  order: SalesOrder;
  onConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
  onShip?: (id: string) => void;
  onCreateInvoice?: (id: string) => void;
  onViewInvoice?: (invoiceId: string) => void;
  onCloseSO?: (id: string) => void; // GAP-003: Close partially shipped SOs
  // eslint-disable-next-line
  layout?: 'list' | 'detail';
}

export default function SalesOrderActions({
  order,
  onConfirm,
  onCancel,
  onShip,
  onCreateInvoice,
  onViewInvoice,
  onCloseSO,
  layout = 'list',
}: SalesOrderActionsProps) {
  // Helper for Invoice Status Badge
  const getInvoiceStatusBadge = (
    status: string,
    balance: DecimalLike
  ) => {
    // Handle Prisma Decimal or number/string
    const numBalance =
      typeof balance === 'object' &&
      balance !== null &&
      'toNumber' in balance
        ? balance.toNumber()
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
  const isPartiallyShipped =
    order.status === OrderStatusSchema.enum.PARTIALLY_SHIPPED;
  const isShipped = order.status === OrderStatusSchema.enum.SHIPPED;
  const isCompleted =
    order.status === OrderStatusSchema.enum.COMPLETED;

  const isUpfront =
    order.paymentTerms === PaymentTermsSchema.enum.UPFRONT;
  const isPaidUpfront =
    order.paymentStatus === PaymentStatusSchema.enum.PAID_UPFRONT;

  // Check for Tempo+DP orders
  const dpAmount = order.dpAmount ? Number(order.dpAmount) : 0;
  const paidAmount = order.paidAmount ? Number(order.paidAmount) : 0;
  const hasDpRequired = isUpfront || dpAmount > 0;

  // Find DP Invoice and check if paid
  const dpInvoice = order.invoices?.find((inv) =>
    inv.notes?.includes('Down Payment')
  );
  const isDpPaid =
    dpInvoice?.status === InvoiceStatusSchema.enum.PAID;

  // Logic: Block ship if DP required and not paid
  // Allow if: paid via upfront flow (paidAmount > 0) OR DP Invoice is PAID
  const canShip =
    (isConfirmed || isPartiallyShipped) &&
    (!hasDpRequired || isPaidUpfront || paidAmount > 0 || isDpPaid);

  // Only show Create Invoice for final invoice (after shipment), not DP Invoice
  const finalInvoices = order.invoices?.filter(
    (inv) => !inv.notes?.includes('Down Payment')
  );
  const finalInvoice =
    finalInvoices && finalInvoices.length > 0
      ? finalInvoices[0]
      : null;
  const canCreateInvoice =
    (isShipped || isPartiallyShipped || isCompleted) && !finalInvoice;

  return (
    <div
      className={
        layout === 'list'
          ? 'flex items-start justify-end gap-3'
          : 'flex flex-wrap gap-3'
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

      {/* Ship Order */}
      {canShip && onShip && (
        <ActionButton
          onClick={() => onShip(order.id)}
          variant="success"
        >
          Ship
        </ActionButton>
      )}

      {/* Create Invoice */}
      {canCreateInvoice && onCreateInvoice && (
        <ActionButton
          onClick={() => onCreateInvoice(order.id)}
          variant="primary"
        >
          Create Invoice
        </ActionButton>
      )}

      {/* Close SO - GAP-003: Allow closing partially shipped SOs */}
      {(isConfirmed || isPartiallyShipped) && onCloseSO && (
        <ActionButton
          onClick={() => onCloseSO(order.id)}
          variant="warning"
        >
          Close SO
        </ActionButton>
      )}

      {/* View DP Invoice - if exists */}
      {dpInvoice && onViewInvoice && (
        <div
          className={
            layout === 'list'
              ? 'flex flex-col items-center gap-1'
              : 'contents'
          }
        >
          <ActionButton
            onClick={() => onViewInvoice(dpInvoice.id)}
            variant="warning"
          >
            View DP Invoice
          </ActionButton>
          {layout === 'list' && (
            <span
              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                getInvoiceStatusBadge(
                  dpInvoice.status,
                  Number(dpInvoice.balance)
                ).color
              }`}
            >
              {
                getInvoiceStatusBadge(
                  dpInvoice.status,
                  Number(dpInvoice.balance)
                ).label
              }
            </span>
          )}
        </div>
      )}

      {/* View Final Invoice - if exists */}
      {finalInvoice && onViewInvoice && (
        <div
          className={
            layout === 'list'
              ? 'flex flex-col items-center gap-1'
              : 'contents'
          }
        >
          <ActionButton
            onClick={() => onViewInvoice(finalInvoice.id)}
            variant="secondary"
          >
            View Invoice
          </ActionButton>
          {layout === 'list' && (
            <span
              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                getInvoiceStatusBadge(
                  finalInvoice.status,
                  Number(finalInvoice.balance)
                ).color
              }`}
            >
              {
                getInvoiceStatusBadge(
                  finalInvoice.status,
                  Number(finalInvoice.balance)
                ).label
              }
            </span>
          )}
        </div>
      )}
    </div>
  );
}
