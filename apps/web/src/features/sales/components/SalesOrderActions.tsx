import ActionButton from '@/components/ui/ActionButton';
import {
  OrderStatusSchema,
  PaymentTermsSchema,
  PaymentStatusSchema,
  InvoiceStatusSchema,
  DocumentStatusSchema,
} from '@sync-erp/shared';
import { DecimalLike } from '@/types/decimal';
import { getInvoiceStatusBadge } from '@/features/accounting/utils/financeEnums';

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
  fulfillments?: {
    id: string;
    status: string;
    number: string;
  }[];
}

interface SalesOrderActionsProps {
  order: SalesOrder;
  onConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
  onShip?: (id: string) => void;
  onCreateInvoice?: (id: string) => void;
  onViewInvoice?: (invoiceId: string) => void;
  onViewShipment?: (shipmentId: string) => void;
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
  onViewShipment,
  onCloseSO,
  layout = 'list',
}: SalesOrderActionsProps) {
  // Status flags and permission logic

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
  // Check for draft/posted Shipments
  const draftShipment = order.fulfillments?.find(
    (f) => f.status === DocumentStatusSchema.enum.DRAFT
  );
  const postedShipment = order.fulfillments?.find(
    (f) => f.status === DocumentStatusSchema.enum.POSTED
  );
  const hasDraftShipment = !!draftShipment;

  const canShip =
    (isConfirmed || isPartiallyShipped) &&
    (!hasDpRequired || isPaidUpfront || paidAmount > 0 || isDpPaid) &&
    !hasDraftShipment; // Don't show "Ship" if draft shipment exists

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

      {/* View Draft Shipment - if exists, show button to continue */}
      {draftShipment && onViewShipment && (
        <div
          className={
            layout === 'list'
              ? 'flex flex-col items-center gap-1'
              : 'contents'
          }
        >
          <ActionButton
            onClick={() => onViewShipment(draftShipment.id)}
            variant="warning"
          >
            Continue Shipment
          </ActionButton>
          {layout === 'list' && (
            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
              ◌ Draft
            </span>
          )}
        </div>
      )}

      {/* View Posted Shipment - if exists */}
      {postedShipment && onViewShipment && !draftShipment && (
        <ActionButton
          onClick={() => onViewShipment(postedShipment.id)}
          variant="secondary"
        >
          View Shipment
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
