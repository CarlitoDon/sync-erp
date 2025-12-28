import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { useOrderMutations } from '@/hooks/useOrderMutations';
import { formatCurrency, formatDate } from '@/utils/format';
import { ShipmentModal } from '@/features/inventory/components/ShipmentModal';
import CreateInvoiceModal from '@/features/accounting/components/CreateInvoiceModal';
import { PageContainer } from '@/components/layout/PageLayout';
import SalesOrderActions from '../components/SalesOrderActions';
import { CustomerDepositCard } from '../components/CustomerDepositCard';
import { RegisterDepositModal } from '../components/RegisterDepositModal';
import {
  PaymentTermsSchema,
  OrderStatusSchema,
  PaymentStatusSchema,
  InvoiceStatusSchema,
  PaymentTermsType,
  PaymentStatusType,
} from '@sync-erp/shared';
import {
  ActionButton,
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

  const { data: order, isLoading: loading } =
    trpc.salesOrder.getById.useQuery(
      { id: id! },
      { enabled: !!id && !!currentCompany?.id }
    );

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

  const handleCloseSO = (orderId: string) => {
    const reason = prompt(
      'Please enter a reason for closing this SO:'
    );
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
        {(() => {
          const dpAmount = order.dpAmount
            ? Number(order.dpAmount)
            : 0;
          const dpPercent = order.dpPercent
            ? Number(order.dpPercent)
            : 0;
          const hasDpRequired = isUpfrontOrder || dpAmount > 0;
          const dpInvoice = order.invoices?.find((inv) =>
            inv.notes?.includes('Down Payment')
          );
          const isDpPaid =
            dpInvoice?.status === InvoiceStatusSchema.enum.PAID;

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
                      ? '✅ Customer Deposit Received'
                      : '💰 Customer Deposit Required'}
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
                      Remaining after deposit:{' '}
                      {formatCurrency(
                        Number(order.totalAmount) - dpAmount
                      )}
                    </p>
                  )}
                </div>
                {dpInvoice ? (
                  <ActionButton
                    variant={isDpPaid ? 'secondary' : 'primary'}
                    onClick={() =>
                      navigate(`/invoices/${dpInvoice.id}`)
                    }
                  >
                    {isDpPaid ? 'View DP Invoice' : '💳 Collect DP →'}
                  </ActionButton>
                ) : (
                  <span className="text-sm text-gray-500">
                    Confirm SO to create Deposit Invoice
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
