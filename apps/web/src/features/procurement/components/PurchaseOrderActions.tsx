import ActionButton from '@/components/ui/ActionButton';
import {
  OrderStatusSchema,
  PaymentTermsSchema,
  PaymentStatusSchema,
  InvoiceStatusSchema,
  DocumentStatusSchema,
} from '@sync-erp/shared';
import { DecimalLike } from '@/types/decimal';
import { getBillStatusBadge } from '@/features/accounting/utils/financeEnums';

interface PurchaseOrder {
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

interface PurchaseOrderActionsProps {
  order: PurchaseOrder;
  onConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
  onReceiveGoods?: (id: string) => void;
  onCreateBill?: (id: string) => void;
  onCreateDpBill?: (id: string) => void; // Feature 041: Manual DP Bill creation
  onViewBill?: (billId: string) => void;
  onViewGRN?: (grnId: string) => void;
  onClosePO?: (id: string) => void; // GAP-001: Close partially received POs
  // eslint-disable-next-line
  layout?: 'list' | 'detail';
}

export default function PurchaseOrderActions({
  order,
  onConfirm,
  onCancel,
  onReceiveGoods,
  onCreateBill,
  onCreateDpBill,
  onViewBill,
  onViewGRN,
  onClosePO,
  layout = 'list',
}: PurchaseOrderActionsProps) {
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

  // Check for Tempo+DP orders
  const dpAmount = order.dpAmount ? Number(order.dpAmount) : 0;
  const paidAmount = order.paidAmount ? Number(order.paidAmount) : 0;
  const hasDpRequired = isUpfront || dpAmount > 0;

  // Find DP Bill and check if paid
  const dpBill = order.invoices?.find((inv) =>
    inv.notes?.includes('Down Payment')
  );
  const isDpPaid = dpBill?.status === InvoiceStatusSchema.enum.PAID;

  // Check for draft/posted GRNs
  const draftGRN = order.fulfillments?.find(
    (f) => f.status === DocumentStatusSchema.enum.DRAFT
  );
  const postedGRN = order.fulfillments?.find(
    (f) => f.status === DocumentStatusSchema.enum.POSTED
  );
  const hasDraftGRN = !!draftGRN;

  // Logic: Block receive if DP required and not paid, OR if there's already a draft GRN
  // Allow if: paid via upfront flow (paidAmount > 0) OR DP Bill is PAID
  const canReceiveGoods =
    (isConfirmed || isPartiallyReceived) &&
    (!hasDpRequired || isPaidUpfront || paidAmount > 0 || isDpPaid) &&
    !hasDraftGRN; // Don't show "Receive Goods" if draft GRN exists

  // Only show Create Bill for final bill (after GRN), not DP Bill
  const finalBills = order.invoices?.filter(
    (inv) => !inv.notes?.includes('Down Payment')
  );
  const finalBill =
    finalBills && finalBills.length > 0 ? finalBills[0] : null;
  const canCreateBill =
    (isReceived || isPartiallyReceived || isCompleted) && !finalBill;

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

      {/* Receive Goods */}
      {canReceiveGoods && onReceiveGoods && (
        <ActionButton
          onClick={() => onReceiveGoods(order.id)}
          variant="success"
        >
          Receive Goods
        </ActionButton>
      )}

      {/* View Draft GRN - if exists, show button to continue */}
      {draftGRN && onViewGRN && (
        <div
          className={
            layout === 'list'
              ? 'flex flex-col items-center gap-1'
              : 'contents'
          }
        >
          <ActionButton
            onClick={() => onViewGRN(draftGRN.id)}
            variant="warning"
          >
            Continue GRN
          </ActionButton>
          {layout === 'list' && (
            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
              ◌ Draft
            </span>
          )}
        </div>
      )}

      {/* View Posted GRN - if exists */}
      {postedGRN && onViewGRN && !draftGRN && (
        <ActionButton
          onClick={() => onViewGRN(postedGRN.id)}
          variant="secondary"
        >
          View GRN
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

      {/* Close PO - GAP-001: Allow closing partially received POs */}
      {(isConfirmed || isPartiallyReceived) && onClosePO && (
        <ActionButton
          onClick={() => onClosePO(order.id)}
          variant="warning"
        >
          Close PO
        </ActionButton>
      )}

      {/* Create DP Bill - if CONFIRMED, has DP requirement, and no DP Bill yet */}
      {isConfirmed && hasDpRequired && !dpBill && onCreateDpBill && (
        <ActionButton
          onClick={() => onCreateDpBill(order.id)}
          variant="primary"
        >
          Create DP Bill
        </ActionButton>
      )}

      {/* View DP Bill - if exists */}
      {dpBill && onViewBill && (
        <div
          className={
            layout === 'list'
              ? 'flex flex-col items-center gap-1'
              : 'contents'
          }
        >
          <ActionButton
            onClick={() => onViewBill(dpBill.id)}
            variant="warning"
          >
            View DP Bill
          </ActionButton>
          {layout === 'list' && (
            <span
              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                getBillStatusBadge(
                  dpBill.status,
                  Number(dpBill.balance)
                ).color
              }`}
            >
              {
                getBillStatusBadge(
                  dpBill.status,
                  Number(dpBill.balance)
                ).label
              }
            </span>
          )}
        </div>
      )}

      {/* View Final Bill - if exists */}
      {finalBill && onViewBill && (
        <div
          className={
            layout === 'list'
              ? 'flex flex-col items-center gap-1'
              : 'contents'
          }
        >
          <ActionButton
            onClick={() => onViewBill(finalBill.id)}
            variant="secondary"
          >
            View Bill
          </ActionButton>
          {layout === 'list' && (
            <span
              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                getBillStatusBadge(
                  finalBill.status,
                  Number(finalBill.balance)
                ).color
              }`}
            >
              {
                getBillStatusBadge(
                  finalBill.status,
                  Number(finalBill.balance)
                ).label
              }
            </span>
          )}
        </div>
      )}
    </div>
  );
}
