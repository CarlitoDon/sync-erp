import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { useOrderMutations } from '@/hooks/useOrderMutations';
import { formatDate } from '@/utils/format';
import { ShipmentModal } from '@/features/inventory/components/ShipmentModal';
import CreateInvoiceModal from '@/features/accounting/components/CreateInvoiceModal';
import { PageContainer } from '@/components/layout/PageLayout';
import SalesOrderActions from '../components/SalesOrderActions';
import { CustomerDepositCard } from '../components/CustomerDepositCard';
import { RegisterDepositModal } from '../components/RegisterDepositModal';
import { usePrompt } from '@/components/ui/PromptModal';
import {
  PaymentTermsSchema,
  OrderStatusSchema,
  PaymentStatusSchema,
  PaymentTermsType,
  PaymentStatusType,
} from '@sync-erp/shared';
import { useSalesOrderCalculations } from '../hooks/useSalesOrderCalculations';
import { SalesOrderStats } from '../components/SalesOrderStats';
import { SalesOrderShipments } from '../components/SalesOrderShipments';
import { SalesOrderDepositStatus } from '../components/SalesOrderDepositStatus';
import {
  BackButton,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  PaymentTermsBadge,
  PaymentStatusBadge,
  StatusBadge,
  LoadingState,
  EmptyState,
  FulfillmentStatusBadge,
  OrderItemsTable,
} from '@/components/ui';

export default function SalesOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();
  const [shipmentModalOpen, setShipmentModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const prompt = usePrompt();

  const { data: order, isLoading: loading } =
    trpc.salesOrder.getById.useQuery(
      { id: id! },
      { enabled: !!id && !!currentCompany?.id }
    );

  const calculations = useSalesOrderCalculations(order);

  const { handleConfirm, handleCancel } = useOrderMutations({
    type: 'sales',
    onSuccess: () => utils.salesOrder.getById.invalidate({ id: id! }),
  });

  // GAP-003: Close SO mutation
  const closeMutation = trpc.salesOrder.close.useMutation({
    onSuccess: () => {
      utils.salesOrder.getById.invalidate({ id: id! });
    },
  });

  const handleCloseSO = async (orderId: string) => {
    const reason = await prompt({
      title: 'Close Sales Order',
      message: 'Please enter a reason for closing this SO:',
      placeholder: 'Enter reason...',
      required: true,
    });
    if (reason && reason.trim()) {
      closeMutation.mutate({ id: orderId, reason: reason.trim() });
    }
  };

  // Cash Upfront: Fetch deposit summary if order has UPFRONT terms
  const isUpfrontOrder =
    order?.paymentTerms === PaymentTermsSchema.enum.UPFRONT;
  const { data: depositSummary } =
    trpc.customerDeposit.getDepositSummary.useQuery(
      { orderId: id! },
      { enabled: !!id && !!order && isUpfrontOrder }
    );

  if (loading) {
    return <LoadingState />;
  }

  if (!order) {
    return <EmptyState message="Order not found" />;
  }

  return (
    <>
      {/* Shipment Modal */}
      <ShipmentModal
        isOpen={shipmentModalOpen}
        salesOrderId={order.id}
        orderItems={order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          price: Number(item.price),
          product: item.product,
        }))}
        onClose={() => setShipmentModalOpen(false)}
        onSuccess={() => {
          setShipmentModalOpen(false);
          utils.salesOrder.getById.invalidate({ id: id! });
        }}
      />

      {/* Invoice Creation Modal */}
      <CreateInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        orderId={order.id}
        onSuccess={(invoiceId) => {
          utils.salesOrder.getById.invalidate({ id: id! });
          navigate(`/invoices/${invoiceId}`);
        }}
      />

      {/* Cash Upfront: Deposit Registration Modal */}
      {isUpfrontOrder && (
        <RegisterDepositModal
          isOpen={isDepositModalOpen}
          onClose={() => setIsDepositModalOpen(false)}
          orderId={order.id}
          orderNumber={order.orderNumber || order.id}
          maxAmount={
            depositSummary?.remainingAmount ||
            Number(order.totalAmount)
          }
          onSuccess={() => {
            utils.customerDeposit.getDepositSummary.invalidate({
              orderId: id!,
            });
            utils.salesOrder.getById.invalidate({ id: id! });
          }}
        />
      )}

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
                {order.partner?.name || 'Unknown Customer'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <StatusBadge status={order.status} domain="order" />
            {/* Payment badges */}
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

        {/* Warning: UPFRONT orders require deposit before shipment */}
        {order.paymentTerms === PaymentTermsSchema.enum.UPFRONT &&
          order.paymentStatus !==
            PaymentStatusSchema.enum.PAID_UPFRONT &&
          order.status !== OrderStatusSchema.enum.DRAFT &&
          order.status !== OrderStatusSchema.enum.CANCELLED && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg flex items-start gap-3">
              <span className="text-amber-600 text-xl">⚠️</span>
              <div>
                <p className="font-semibold text-amber-800">
                  Waiting Customer Deposit
                </p>
                <p className="text-sm text-amber-700">
                  This order requires upfront payment before goods can
                  be shipped. Please collect customer deposit first.
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
                <p className="text-sm text-gray-500">Customer</p>
                <p className="font-medium">
                  {order.partner ? (
                    <Link
                      to={`/customers/${order.partnerId}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {order.partner.name}
                    </Link>
                  ) : (
                    '-'
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="font-medium">
                  {formatDate(order.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">
                  Shipment Status
                </p>
                <FulfillmentStatusBadge
                  status={order.status}
                  type="shipment"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <SalesOrderStats calculations={calculations} />

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
              fulfilledQuantity: (
                item as typeof item & { shippedQuantity?: number }
              ).shippedQuantity,
              price: item.price,
              product: item.product,
            }))}
            showFulfilled={true}
            fulfillmentLabel="Shipped"
          />
        </Card>

        {/* Feature 041: Shipments Card - Show linked invoices */}
        <SalesOrderShipments fulfillments={order.fulfillments} />

        {/* Cash Upfront: Customer Deposit Card */}
        {isUpfrontOrder && depositSummary && (
          <CustomerDepositCard
            totalAmount={depositSummary.totalAmount}
            paidAmount={depositSummary.paidAmount}
            remainingAmount={depositSummary.remainingAmount}
            paymentStatus={depositSummary.paymentStatus}
            onRegisterDeposit={() => setIsDepositModalOpen(true)}
            canRegisterDeposit={
              order.status === OrderStatusSchema.enum.CONFIRMED &&
              depositSummary.remainingAmount > 0
            }
          />
        )}

        {/* DP Invoice Info - Show for UPFRONT or orders with dpAmount */}
        <SalesOrderDepositStatus
          order={order}
          calculations={calculations}
        />

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <SalesOrderActions
              order={order}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              onShip={() => setShipmentModalOpen(true)}
              onCreateInvoice={() => setIsInvoiceModalOpen(true)}
              onViewInvoice={(invoiceId) =>
                navigate(`/invoices/${invoiceId}`)
              }
              onCloseSO={handleCloseSO}
              layout="detail"
            />
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
