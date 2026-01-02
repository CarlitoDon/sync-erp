import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { useOrderMutations } from '@/hooks/useOrderMutations';
import PurchaseOrderActions from '../components/PurchaseOrderActions';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from '@/utils/format';
import { GoodsReceiptModal } from '@/features/inventory/components/GoodsReceiptModal';
import CreateBillModal from '@/features/accounting/components/CreateBillModal';
import CreateDpBillModal from '@/features/accounting/components/CreateDpBillModal';
import {
  PaymentTermsSchema,
  OrderStatusSchema,
  PaymentStatusSchema,
  DocumentStatusSchema,
  InvoiceStatusSchema,
  PaymentTermsType,
  PaymentStatusType,
} from '@sync-erp/shared';
import { PageContainer } from '@/components/layout/PageLayout';
import {
  ActionButton,
  BackButton,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PaymentTermsBadge,
  PaymentStatusBadge,
  StatusBadge,
  LoadingState,
  EmptyState,
  FulfillmentStatusBadge,
  OrderItemsTable,
} from '@/components/ui';
import { Timeline, TimelineEvent } from '@/components/ui/Timeline';

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();
  const [goodsReceiptId, setGoodsReceiptId] = useState<string | null>(
    null
  );
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isDpBillModalOpen, setIsDpBillModalOpen] = useState(false);
  const [selectedFulfillmentId, setSelectedFulfillmentId] = useState<
    string | null
  >(null);

  const { data: order, isLoading: loading } =
    trpc.purchaseOrder.getById.useQuery(
      { id: id! },
      { enabled: !!id && !!currentCompany?.id }
    );

  // Feature 036: Check if UPFRONT order
  const isUpfrontOrder =
    order?.paymentTerms === PaymentTermsSchema.enum.UPFRONT;

  const { handleConfirm, handleCancel } = useOrderMutations({
    type: 'purchase',
    onSuccess: () =>
      utils.purchaseOrder.getById.invalidate({ id: id! }),
  });

  const handleCreateBill = () => {
    if (!order) return;
    setIsBillModalOpen(true);
  };

  // Feature 041: Open DP Bill modal
  const handleCreateDpBill = () => {
    if (!order) return;
    setIsDpBillModalOpen(true);
  };

  // GAP-001: Close PO mutation
  const closeMutation = trpc.purchaseOrder.close.useMutation({
    onSuccess: () => {
      utils.purchaseOrder.getById.invalidate({ id: id! });
    },
  });

  const handleClosePO = (orderId: string) => {
    const reason = prompt(
      'Please enter a reason for closing this PO:'
    );
    if (reason && reason.trim()) {
      closeMutation.mutate({ id: orderId, reason: reason.trim() });
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (!order) {
    return <EmptyState message="Order not found" />;
  }

  // Calculate price breakdown
  const taxRate = Number(order.taxRate || 0);
  const totalAmount = Number(order.totalAmount);
  const subtotal =
    taxRate > 0 ? totalAmount / (1 + taxRate / 100) : totalAmount;
  const taxAmount = totalAmount - subtotal;

  return (
    <>
      {/* Goods Receipt Modal */}
      <GoodsReceiptModal
        isOpen={goodsReceiptId !== null}
        purchaseOrderId={goodsReceiptId || ''}
        orderNumber={order.orderNumber || undefined}
        supplierName={order.partner?.name}
        orderItems={(order?.items || []).map((item) => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          price: Number(item.price),
          product: item.product,
        }))}
        onClose={() => setGoodsReceiptId(null)}
        onSuccess={() => {
          setGoodsReceiptId(null);
          utils.purchaseOrder.getById.invalidate({ id: id! });
        }}
      />

      {/* Bill Creation Modal */}
      <CreateBillModal
        isOpen={isBillModalOpen}
        onClose={() => {
          setIsBillModalOpen(false);
          setSelectedFulfillmentId(null);
        }}
        orderId={order.id}
        fulfillmentId={selectedFulfillmentId ?? undefined}
        onSuccess={(_billId) => {
          utils.purchaseOrder.getById.invalidate({ id: id! });
          // Stay on page as per user request
        }}
      />

      {/* DP Bill Creation Modal */}
      <CreateDpBillModal
        isOpen={isDpBillModalOpen}
        onClose={() => setIsDpBillModalOpen(false)}
        orderId={order.id}
        orderNumber={order.orderNumber || undefined}
        defaultDpAmount={Number(order.dpAmount || 0)}
        dpPercent={Number(order.dpPercent || 0)}
        orderTotal={Number(order.totalAmount || 0)}
        onSuccess={(billId) => {
          utils.purchaseOrder.getById.invalidate({ id: id! });
          navigate(`/bills/${billId}`);
        }}
      />

      {/* Two-Column Layout */}
      <PageContainer>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {order.orderNumber}
              </h1>
              <p className="text-sm text-gray-500">
                {order.partner?.name || 'Unknown Supplier'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <StatusBadge status={order.status} domain="order" />
            {order.paymentTerms && (
              <PaymentTermsBadge
                terms={order.paymentTerms as PaymentTermsType}
              />
            )}
            {order.paymentStatus && (
              <PaymentStatusBadge
                status={order.paymentStatus as PaymentStatusType}
              />
            )}
          </div>
        </div>

        {/* Stage 3 Warning: UPFRONT orders require payment before goods receipt */}
        {order.paymentTerms === PaymentTermsSchema.enum.UPFRONT &&
          order.paymentStatus !==
            PaymentStatusSchema.enum.PAID_UPFRONT &&
          order.status !== OrderStatusSchema.enum.DRAFT &&
          order.status !== OrderStatusSchema.enum.CANCELLED && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg flex items-start gap-3 mb-6">
              <span className="text-amber-600 text-xl">⚠️</span>
              <div>
                <p className="font-semibold text-amber-800">
                  Waiting Prepayment
                </p>
                <p className="text-sm text-amber-700">
                  This order requires upfront payment before goods can
                  be received. Please complete payment first.
                </p>
              </div>
            </div>
          )}

        {/* Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT SIDEBAR - Sticky */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6 space-y-4">
              {/* Order Info Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Order Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Order Number
                      </p>
                      <p className="font-mono font-medium text-sm">
                        {order.orderNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Created
                      </p>
                      <p className="font-medium text-sm">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Supplier
                    </p>
                    {order.partner ? (
                      <Link
                        to={`/suppliers/${order.partnerId}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium"
                      >
                        {order.partner.name}
                      </Link>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Tax Rate
                      </p>
                      <p className="font-medium text-sm">
                        {order.taxRate
                          ? `${Number(order.taxRate)}%`
                          : 'No Tax'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Receipt Status
                      </p>
                      <FulfillmentStatusBadge
                        status={order.status}
                        type="receipt"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Price Summary Card with DP Breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    💰 Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-medium">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">
                      Tax ({taxRate}%)
                    </span>
                    <span className="font-medium">
                      {formatCurrency(taxAmount)}
                    </span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">
                      Total Order
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>

                  {/* DP Breakdown - Show when DP is required */}
                  {order.computed?.hasDpRequired &&
                    !isUpfrontOrder && (
                      <>
                        <hr className="my-2" />
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                          Rincian Pembayaran
                        </p>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500">
                            DP ({order.computed.actualDpPercent}%)
                          </span>
                          <span
                            className={`font-semibold ${order.computed.isDpPaid ? 'text-green-600' : 'text-purple-600'}`}
                          >
                            {formatCurrency(
                              order.computed.actualDpAmount
                            )}
                            {order.computed.isDpPaid && ' ✓'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500">
                            Sisa (setelah GRN)
                          </span>
                          <span className="font-semibold text-gray-700">
                            {formatCurrency(
                              Number(order.totalAmount) -
                                order.computed.actualDpAmount
                            )}
                          </span>
                        </div>
                      </>
                    )}

                  {/* UPFRONT Breakdown */}
                  {isUpfrontOrder && (
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
                          className={`font-semibold ${order.paymentStatus === PaymentStatusSchema.enum.PAID_UPFRONT ? 'text-green-600' : 'text-amber-600'}`}
                        >
                          {formatCurrency(totalAmount)}
                          {order.paymentStatus ===
                            PaymentStatusSchema.enum.PAID_UPFRONT &&
                            ' ✓'}
                        </span>
                      </div>
                    </>
                  )}

                  <hr className="my-2" />
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">
                      Total Billed
                    </span>
                    <span className="font-semibold text-blue-600">
                      {formatCurrency(
                        order.computed?.totalBilled || 0
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Outstanding</span>
                    <span className="font-semibold text-amber-600">
                      {formatCurrency(
                        order.computed?.outstanding || 0
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Feature 036: DP Payment Info */}
              {order.computed?.hasDpRequired && (
                <div
                  className={`border-l-4 p-4 rounded-lg ${
                    order.computed.isDpPaid
                      ? 'bg-green-50 border-green-500'
                      : 'bg-blue-50 border-blue-500'
                  }`}
                >
                  <p
                    className={`font-semibold text-sm ${
                      order.computed.isDpPaid
                        ? 'text-green-800'
                        : 'text-blue-800'
                    }`}
                  >
                    {order.computed.isDpPaid
                      ? '✅ Down Payment Paid'
                      : '💰 Down Payment Required'}
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      order.computed.isDpPaid
                        ? 'text-green-700'
                        : 'text-blue-700'
                    }`}
                  >
                    {isUpfrontOrder
                      ? `Full upfront: ${formatCurrency(Number(order.totalAmount))}`
                      : `DP ${order.computed.actualDpPercent}%: ${formatCurrency(order.computed.actualDpAmount)}`}
                  </p>
                  {!order.computed.isDpPaid && !isUpfrontOrder && (
                    <p className="text-xs text-blue-600 mt-1">
                      Sisa:{' '}
                      {formatCurrency(
                        Number(order.totalAmount) -
                          order.computed.actualDpAmount
                      )}
                    </p>
                  )}
                  <div className="mt-3">
                    {order.computed.dpBillId ? (
                      <ActionButton
                        variant={
                          order.computed.isDpPaid
                            ? 'secondary'
                            : 'primary'
                        }
                        onClick={() =>
                          navigate(
                            `/bills/${order.computed.dpBillId}`
                          )
                        }
                        className="w-full text-sm"
                      >
                        {order.computed.isDpPaid
                          ? 'View DP Bill'
                          : '💳 Pay DP Bill →'}
                      </ActionButton>
                    ) : order.status ===
                      OrderStatusSchema.enum.CONFIRMED ? (
                      <ActionButton
                        variant="primary"
                        onClick={() => setIsDpBillModalOpen(true)}
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
              )}

              {/* Actions Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    ⚡ Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <PurchaseOrderActions
                      order={order}
                      onConfirm={handleConfirm}
                      onCancel={handleCancel}
                      onReceiveGoods={() =>
                        setGoodsReceiptId(order.id)
                      }
                      onCreateBill={handleCreateBill}
                      onCreateDpBill={handleCreateDpBill}
                      onViewBill={(billId) =>
                        navigate(`/bills/${billId}`)
                      }
                      onClosePO={handleClosePO}
                      layout="detail"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* RIGHT MAIN CONTENT */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle>📦 Order Items</CardTitle>
              </CardHeader>
              <OrderItemsTable
                items={order.items.map((item) => ({
                  id: item.id,
                  productId: item.productId,
                  quantity: item.quantity,
                  fulfilledQuantity: (
                    item as typeof item & {
                      receivedQuantity?: number;
                    }
                  ).receivedQuantity,
                  price: item.price,
                  product: item.product,
                }))}
                showFulfilled={true}
                fulfillmentLabel="Received"
              />
            </Card>

            {/* Goods Receipts (GRN) */}
            {order.fulfillments && order.fulfillments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>📥 Goods Receipts (GRN)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-500">
                            GRN Number
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-500">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-500">
                            Linked Bill
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {order.fulfillments.map((grn) => {
                          const activeBill = grn.invoices?.find(
                            (inv) =>
                              inv.status !==
                              InvoiceStatusSchema.enum.VOID
                          );
                          const linkedBill =
                            activeBill || grn.invoices?.[0];
                          return (
                            <tr
                              key={grn.id}
                              className="hover:bg-gray-50"
                            >
                              <td className="px-4 py-3 font-mono">
                                <Link
                                  to={`/receipts/${grn.id}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {grn.number}
                                </Link>
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge
                                  status={grn.status}
                                  domain="document"
                                />
                              </td>
                              <td className="px-4 py-3">
                                {linkedBill ? (
                                  <Link
                                    to={`/bills/${linkedBill.id}`}
                                    className="text-blue-600 hover:text-blue-800 hover:underline font-mono"
                                  >
                                    {linkedBill.invoiceNumber}
                                  </Link>
                                ) : (
                                  <span className="text-gray-400 italic">
                                    No bill created
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right space-x-2">
                                <ActionButton
                                  variant="secondary"
                                  onClick={() =>
                                    navigate(`/receipts/${grn.id}`)
                                  }
                                >
                                  View
                                </ActionButton>
                                {(!linkedBill ||
                                  linkedBill.status ===
                                    InvoiceStatusSchema.enum.VOID) &&
                                  grn.status ===
                                    DocumentStatusSchema.enum
                                      .POSTED && (
                                    <ActionButton
                                      variant="primary"
                                      onClick={() => {
                                        setSelectedFulfillmentId(
                                          grn.id
                                        );
                                        setIsBillModalOpen(true);
                                      }}
                                    >
                                      Create Bill
                                    </ActionButton>
                                  )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bills */}
            {order.invoices && order.invoices.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>📄 Bills</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-500">
                            Bill Number
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-500">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-500">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500">
                            Amount
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {order.invoices.map((bill) => (
                          <tr
                            key={bill.id}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-4 py-3 font-mono">
                              <Link
                                to={`/bills/${bill.id}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {bill.invoiceNumber}
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              {bill.isDownPayment ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  DP Bill
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Regular Bill
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge
                                status={bill.status}
                                domain="invoice"
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {formatCurrency(Number(bill.amount))}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <ActionButton
                                variant="secondary"
                                onClick={() =>
                                  navigate(`/bills/${bill.id}`)
                                }
                              >
                                View
                              </ActionButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* PO Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>📋 PO Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <Timeline
                  events={(() => {
                    const events: TimelineEvent[] = [];

                    // Created
                    events.push({
                      id: 'created',
                      title: 'Created',
                      description: formatDateTime(order.createdAt),
                      color: 'blue',
                    });

                    // Confirmed
                    if (
                      order.status !== OrderStatusSchema.enum.DRAFT
                    ) {
                      events.push({
                        id: 'confirmed',
                        title: 'Confirmed',
                        description: `${formatDateTime(order.updatedAt)} • PO approved and sent to supplier`,
                        color: 'green',
                      });
                    }

                    // DP Paid
                    if (
                      order.computed?.hasDpRequired &&
                      order.computed.isDpPaid
                    ) {
                      const dpBill = order.invoices?.find(
                        (inv) => inv.isDownPayment
                      );
                      events.push({
                        id: 'dp-paid',
                        title: isUpfrontOrder
                          ? 'Upfront Payment Received'
                          : 'Down Payment Received',
                        description: `${dpBill ? formatDateTime(dpBill.createdAt) : ''} • ${
                          isUpfrontOrder
                            ? `Full payment: ${formatCurrency(totalAmount)}`
                            : `DP ${order.computed.actualDpPercent}%: ${formatCurrency(order.computed.actualDpAmount)}`
                        }`,
                        color: 'purple',
                      });
                    }

                    // Partially Received
                    if (
                      order.status ===
                      OrderStatusSchema.enum.PARTIALLY_RECEIVED
                    ) {
                      const firstGrn = order.fulfillments?.[0];
                      events.push({
                        id: 'partially-received',
                        title: 'Partially Received',
                        description: `${firstGrn ? formatDateTime(firstGrn.createdAt) : ''} • ${order.fulfillments?.length || 0} GRN(s) created`,
                        color: 'amber',
                      });
                    }

                    // Fully Received
                    if (
                      order.status === OrderStatusSchema.enum.RECEIVED
                    ) {
                      const lastGrn =
                        order.fulfillments?.[
                          order.fulfillments.length - 1
                        ];
                      events.push({
                        id: 'received',
                        title: 'Fully Received',
                        description: `${lastGrn ? formatDateTime(lastGrn.createdAt) : ''} • All items have been received`,
                        color: 'emerald',
                      });
                    }

                    // Billed
                    if (order.invoices && order.invoices.length > 0) {
                      const regularBills = order.invoices.filter(
                        (inv) => !inv.isDownPayment
                      );
                      const firstBill =
                        regularBills[0] || order.invoices[0];
                      events.push({
                        id: 'billed',
                        title: 'Billed',
                        description: `${formatDateTime(firstBill.createdAt)} • ${order.invoices.length} bill(s) • Total: ${formatCurrency(order.computed?.totalBilled || 0)}`,
                        color: 'blue',
                      });
                    }

                    // Completed
                    if (
                      order.status ===
                      OrderStatusSchema.enum.COMPLETED
                    ) {
                      events.push({
                        id: 'completed',
                        title: 'Completed',
                        description: `${formatDateTime(order.updatedAt)} • PO has been completed`,
                        color: 'gray',
                      });
                    }

                    // Cancelled
                    if (
                      order.status ===
                      OrderStatusSchema.enum.CANCELLED
                    ) {
                      events.push({
                        id: 'cancelled',
                        title: 'Cancelled',
                        description: `${formatDateTime(order.updatedAt)} • PO has been cancelled`,
                        color: 'red',
                      });
                    }

                    // Outstanding
                    if (
                      order.status !==
                        OrderStatusSchema.enum.COMPLETED &&
                      order.status !==
                        OrderStatusSchema.enum.CANCELLED &&
                      (order.computed?.outstanding || 0) > 0
                    ) {
                      events.push({
                        id: 'outstanding',
                        title: 'Outstanding Balance',
                        description: `${formatCurrency(order.computed?.outstanding || 0)} remaining to be billed/paid`,
                        color: 'amber',
                        isAnimated: true,
                        titleClassName: 'text-amber-700',
                        descriptionClassName: 'text-amber-600',
                      });
                    }

                    return events;
                  })()}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
