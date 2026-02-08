import { useParams } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { useOrderMutations } from '@/hooks/useOrderMutations';
import PurchaseOrderActions from '../components/PurchaseOrderActions';
import { GoodsReceiptModal } from '@/features/inventory/components/GoodsReceiptModal';
import CreateBillModal from '@/features/accounting/components/CreateBillModal';
import CreateDpBillModal from '@/features/accounting/components/CreateDpBillModal';
import { PageContainer } from '@/components/layout/PageLayout';
import { LoadingState, EmptyState } from '@/components/ui';
import { POTimelineMermaid } from '../components/POTimelineMermaid';
import { OrderSummaryCard } from '../components/OrderSummaryCard';
import {
  OrderFinancials,
  DpPaymentInfo,
} from '../components/OrderFinancials';
import {
  usePurchaseOrderPermissions,
  usePurchaseOrderCalculations,
  usePurchaseOrderActions,
} from '../hooks';
import { PaymentStatusBadge, StatusBadge } from '@/components/ui';
import { OrderItemsTable } from '@/components/ui';

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  const { data: order, isLoading: loading } =
    trpc.purchaseOrder.getById.useQuery(
      { id: id! },
      { enabled: !!id && !!currentCompany?.id }
    );

  // Use extracted hooks
  const permissions = usePurchaseOrderPermissions(order);
  const calculations = usePurchaseOrderCalculations(order);
  const actions = usePurchaseOrderActions({ orderId: id! });

  const { handleConfirm, handleCancel } = useOrderMutations({
    type: 'purchase',
    onSuccess: () =>
      utils.purchaseOrder.getById.invalidate({ id: id! }),
  });

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
        isOpen={actions.goodsReceiptModal.isOpen}
        purchaseOrderId={actions.goodsReceiptModal.id || ''}
        orderNumber={order.orderNumber || undefined}
        supplierName={order.partner?.name}
        orderItems={(order?.items || []).map((item) => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          price: Number(item.price),
          product: item.product,
        }))}
        onClose={actions.goodsReceiptModal.close}
        onSuccess={actions.goodsReceiptModal.onSuccess}
      />

      {/* Bill Creation Modal */}
      <CreateBillModal
        isOpen={actions.billModal.isOpen}
        onClose={actions.billModal.close}
        orderId={order.id}
        fulfillmentId={
          actions.billModal.selectedFulfillmentId ?? undefined
        }
        onSuccess={actions.billModal.onSuccess}
      />

      {/* DP Bill Creation Modal */}
      <CreateDpBillModal
        isOpen={actions.dpBillModal.isOpen}
        onClose={actions.dpBillModal.close}
        orderId={order.id}
        dpPercent={20} // Default value or from settings
        defaultDpAmount={0} // Will be calc inside
        orderTotal={Number(order.totalAmount)}
        onSuccess={actions.dpBillModal.onSuccess}
      />

      <PageContainer>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          {/* Left: Title & Status */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              {order.orderNumber}
              {/* Status Badges */}
              <div className="flex gap-2">
                <StatusBadge status={order.status} domain="order" />
                {order.paymentStatus && (
                  <PaymentStatusBadge status={order.paymentStatus} />
                )}
              </div>
            </h1>
            <p className="text-gray-500">
              Created on{' '}
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Right: Actions */}
          <div className="flex gap-3">
            <PurchaseOrderActions
              order={order}
              onConfirm={() => handleConfirm(order.id)}
              onCancel={() => handleCancel(order.id)}
              onCreateBill={actions.handleCreateBill}
              onCreateDpBill={actions.handleCreateDpBill}
              onReceiveGoods={actions.handleReceiveGoods}
              onClosePO={() => actions.handleClosePO()}
            />
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items Table */}
            <OrderItemsTable items={order.items || []} />

            {/* Financials Breakdown */}
            <OrderFinancials
              order={order}
              paymentStatus={order.paymentStatus}
            />

            {/* DP Info if exists */}
            {permissions.hasDpRequired && (
              <DpPaymentInfo
                hasDpRequired={permissions.hasDpRequired}
                isDpPaid={permissions.isDpPaid}
                isUpfrontOrder={permissions.isUpfront}
                dpPercent={calculations.dpPercent}
                dpAmount={calculations.dpAmount}
                totalAmount={calculations.totalAmount}
                dpBillId={permissions.dpBill?.id}
                isConfirmed={permissions.isConfirmed}
                onCreateDpBill={actions.handleCreateDpBill}
              />
            )}
            {/* Timeline Mermaid Diagram */}
            <POTimelineMermaid order={order} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <OrderSummaryCard
              orderNumber={order.orderNumber || ''}
              createdAt={order.createdAt}
              supplierId={order.partnerId || ''}
              supplierName={order.partner?.name || ''}
              taxRate={Number(order.taxRate) || 0}
              status={order.status}
            />
          </div>
        </div>
      </PageContainer>
    </>
  );
}
