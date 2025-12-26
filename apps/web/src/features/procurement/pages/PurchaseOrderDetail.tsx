import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { useOrderMutations } from '@/hooks/useOrderMutations';
import PurchaseOrderActions from '../components/PurchaseOrderActions';
import { formatCurrency, formatDate } from '@/utils/format';
import { GoodsReceiptModal } from '@/features/inventory/components/GoodsReceiptModal';
import CreateBillModal from '@/features/accounting/components/CreateBillModal';
import {
  PaymentTermsSchema,
  OrderStatusSchema,
  PaymentStatusSchema,
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

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();
  const [goodsReceiptId, setGoodsReceiptId] = useState<string | null>(
    null
  );
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);

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

  if (loading) {
    return <LoadingState />;
  }

  if (!order) {
    return <EmptyState message="Order not found" />;
  }

  return (
    <>
      {/* Goods Receipt Modal */}
      <GoodsReceiptModal
        isOpen={goodsReceiptId !== null}
        purchaseOrderId={goodsReceiptId || ''}
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
        onClose={() => setIsBillModalOpen(false)}
        orderId={order.id}
        onSuccess={(billId) => {
          utils.purchaseOrder.getById.invalidate({ id: id! });
          navigate(`/bills/${billId}`);
        }}
      />

      {/* Page Content */}
      {/* Page Content */}
      <PageContainer>
        {/* Header */}
        <div className="flex items-center justify-between">
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
            {/* Feature 036: Payment badges */}
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
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg flex items-start gap-3">
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

        {/* Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-500">Order Number</p>
                <p className="font-mono font-medium">
                  {order.orderNumber}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Supplier</p>
                {order.partner ? (
                  <Link
                    to={`/suppliers/${order.partnerId}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {order.partner.name}
                  </Link>
                ) : (
                  '-'
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="font-medium">
                  {formatDate(order.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">
                  Receipt Status
                </p>
                <FulfillmentStatusBadge
                  status={order.status}
                  type="receipt"
                />
              </div>
            </div>

            <hr className="my-6" />

            <div>
              <p className="text-sm text-gray-500 mb-2">
                Total Amount
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(Number(order.totalAmount))}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Items Card */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <OrderItemsTable
            items={order.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              product: item.product,
            }))}
          />
        </Card>

        {/* Feature 036: DP Payment Info - Show for UPFRONT or orders with dpAmount */}
        {(() => {
          const dpAmount = order.dpAmount
            ? Number(order.dpAmount)
            : 0;
          const dpPercent = order.dpPercent
            ? Number(order.dpPercent)
            : 0;
          const hasDpRequired = isUpfrontOrder || dpAmount > 0;
          const dpBill = order.invoices?.find((inv) =>
            inv.notes?.includes('Down Payment')
          );
          const isDpPaid =
            dpBill?.status === InvoiceStatusSchema.enum.PAID;

          if (!hasDpRequired) return null;

          return (
            <div
              className={`border-l-4 p-4 rounded-lg ${
                isDpPaid
                  ? 'bg-green-50 border-green-500'
                  : 'bg-blue-50 border-blue-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className={`font-semibold ${
                      isDpPaid ? 'text-green-800' : 'text-blue-800'
                    }`}
                  >
                    {isDpPaid
                      ? '✅ Down Payment Paid'
                      : '💰 Down Payment Required'}
                  </p>
                  <p
                    className={`text-sm ${
                      isDpPaid ? 'text-green-700' : 'text-blue-700'
                    }`}
                  >
                    {isUpfrontOrder
                      ? `Full upfront payment: ${formatCurrency(Number(order.totalAmount))}`
                      : `DP ${dpPercent}%: ${formatCurrency(dpAmount)}`}
                  </p>
                  {!isDpPaid && !isUpfrontOrder && (
                    <p className="text-xs text-blue-600 mt-1">
                      Sisa bayar setelah GRN:{' '}
                      {formatCurrency(
                        Number(order.totalAmount) - dpAmount
                      )}
                    </p>
                  )}
                </div>
                {dpBill ? (
                  <ActionButton
                    variant={isDpPaid ? 'secondary' : 'primary'}
                    onClick={() => navigate(`/bills/${dpBill.id}`)}
                  >
                    {isDpPaid ? 'View DP Bill' : '💳 Pay DP Bill →'}
                  </ActionButton>
                ) : (
                  <span className="text-sm text-gray-500">
                    Confirm PO to create DP Bill
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <PurchaseOrderActions
                order={order}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                onReceiveGoods={() => setGoodsReceiptId(order.id)}
                onCreateBill={handleCreateBill}
                onViewBill={(billId) => navigate(`/bills/${billId}`)}
                layout="detail"
              />
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
