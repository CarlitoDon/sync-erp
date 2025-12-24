import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm } from '@/components/ui/ConfirmModal';
import ActionButton from '@/components/ui/ActionButton';
import PurchaseOrderActions from '../components/PurchaseOrderActions';
import { formatCurrency, formatDate } from '@/utils/format';
import { GoodsReceiptModal } from '@/features/inventory/components/GoodsReceiptModal';
import { BackButton } from '@/components/ui/BackButton';
import CreateBillModal from '@/features/accounting/components/CreateBillModal';
import { PaymentTermsBadge } from '../components/PaymentTermsBadge';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
import {
  PaymentTermsSchema,
  OrderStatusSchema,
  PaymentStatusSchema,
  PaymentTermsType,
  PaymentStatusType,
} from '@sync-erp/shared';
import { PageContainer } from '@/components/layout/PageLayout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
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

  const confirmMutation = trpc.purchaseOrder.confirm.useMutation({
    onSuccess: () =>
      utils.purchaseOrder.getById.invalidate({ id: id! }),
  });

  const cancelMutation = trpc.purchaseOrder.cancel.useMutation({
    onSuccess: () =>
      utils.purchaseOrder.getById.invalidate({ id: id! }),
  });

  const handleConfirm = async () => {
    if (!order) return;
    await apiAction(
      () => confirmMutation.mutateAsync({ id: order.id }),
      'Order confirmed!'
    );
  };

  const handleCancel = async () => {
    if (!order) return;
    const confirmed = await confirm({
      title: 'Cancel Order',
      message: 'Are you sure you want to cancel this order?',
      confirmText: 'Yes, Cancel',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () => cancelMutation.mutateAsync({ id: order.id }),
      'Order cancelled'
    );
  };

  const handleCreateBill = () => {
    if (!order) return;
    setIsBillModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case OrderStatusSchema.enum.DRAFT:
        return 'bg-gray-100 text-gray-800';
      case OrderStatusSchema.enum.CONFIRMED:
        return 'bg-blue-100 text-blue-800';
      case OrderStatusSchema.enum.PARTIALLY_RECEIVED:
        return 'bg-amber-100 text-amber-800';
      case OrderStatusSchema.enum.RECEIVED:
        return 'bg-teal-100 text-teal-800';
      case OrderStatusSchema.enum.COMPLETED:
        return 'bg-green-100 text-green-800';
      case OrderStatusSchema.enum.CANCELLED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getReceiptStatus = (status: string) => {
    if (
      status === OrderStatusSchema.enum.RECEIVED ||
      status === OrderStatusSchema.enum.COMPLETED
    )
      return {
        label: 'Fully Received',
        color: 'text-green-600 bg-green-50',
      };
    if (status === OrderStatusSchema.enum.PARTIALLY_RECEIVED)
      return {
        label: 'Partial',
        color: 'text-amber-600 bg-amber-50',
      };
    if (status === OrderStatusSchema.enum.CONFIRMED)
      return {
        label: 'Pending',
        color: 'text-blue-600 bg-blue-50',
      };
    if (status === OrderStatusSchema.enum.CANCELLED)
      return { label: 'Cancelled', color: 'text-red-600 bg-red-50' };
    return { label: 'N/A', color: 'text-gray-400 bg-gray-50' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading order details...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Order not found</div>
      </div>
    );
  }

  const receiptStatus = getReceiptStatus(order.status);

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
            <span
              className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full items-center ${getStatusColor(order.status)}`}
            >
              {order.status}
            </span>
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
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${receiptStatus.color}`}
                >
                  {receiptStatus.label}
                </span>
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Product
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Unit Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-3">
                      {item.product ? (
                        <Link
                          to={`/products/${item.productId}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {item.product.name}
                        </Link>
                      ) : (
                        item.productId
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {formatCurrency(Number(item.price))}
                    </td>
                    <td className="px-6 py-3 text-right font-medium">
                      {formatCurrency(
                        item.quantity * Number(item.price)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Feature 036: UPFRONT Payment Info - Direct user to pay via Bill */}
        {isUpfrontOrder &&
          order.invoices &&
          order.invoices.length > 0 && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-blue-800">
                    Down Payment Bill Created
                  </p>
                  <p className="text-sm text-blue-700">
                    Please pay via the Bill to complete the upfront
                    payment.
                  </p>
                </div>
                <ActionButton
                  variant="primary"
                  onClick={() =>
                    navigate(`/bills/${order.invoices![0].id}`)
                  }
                >
                  Go to Bill →
                </ActionButton>
              </div>
            </div>
          )}

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
