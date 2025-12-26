import ActionButton from '@/components/ui/ActionButton';
import {
  OrderStatusSchema,
  InvoiceStatusSchema,
} from '@sync-erp/shared';

interface SalesOrder {
  id: string;
  status: string;
  invoices?: {
    id: string;
    status: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    balance: any; // Handle Prisma Decimal
  }[];
}

interface SalesOrderActionsProps {
  order: SalesOrder;
  onConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
  onShip?: (id: string) => void;
  onCreateInvoice?: (id: string) => void;
  onViewInvoice?: (invoiceId: string) => void;
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
  layout = 'list',
}: SalesOrderActionsProps) {
  // Helper for Invoice Status Badge
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getInvoiceStatusBadge = (status: string, balance: any) => {
    const numBalance =
      typeof balance === 'object' &&
      balance !== null &&
      'toNumber' in balance
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (balance as any).toNumber()
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

  const canShip = isConfirmed || isPartiallyShipped;
  const canCreateInvoice =
    (isShipped || isPartiallyShipped || isCompleted) &&
    (!order.invoices || order.invoices.length === 0);

  const hasInvoice = order.invoices && order.invoices.length > 0;
  const firstInvoice = hasInvoice ? order.invoices![0] : null;

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

      {/* View Invoice */}
      {hasInvoice && onViewInvoice && firstInvoice && (
        <div
          className={
            layout === 'list'
              ? 'flex flex-col items-end gap-1 inline-flex align-middle'
              : 'contents'
          }
        >
          <ActionButton
            onClick={() => onViewInvoice(firstInvoice.id)}
            variant="secondary"
          >
            View Invoice
          </ActionButton>
          {layout === 'list' && (
            <span
              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                getInvoiceStatusBadge(
                  firstInvoice.status,
                  Number(firstInvoice.balance)
                ).color
              }`}
            >
              {
                getInvoiceStatusBadge(
                  firstInvoice.status,
                  Number(firstInvoice.balance)
                ).label
              }
            </span>
          )}
        </div>
      )}
    </div>
  );
}
