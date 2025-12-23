import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm } from '@/components/ui/ConfirmModal';
import ActionButton from '@/components/ui/ActionButton';
import { formatCurrency, formatDate } from '@/utils/format';
import { ShipmentModal } from '@/features/inventory/components/ShipmentModal';
import { BackButton } from '@/components/ui/BackButton';
import CreateInvoiceModal from '@/features/accounting/components/CreateInvoiceModal';

export default function SalesOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();
  const confirm = useConfirm();
  const [shipmentModalOpen, setShipmentModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  const { data: order, isLoading: loading } =
    trpc.salesOrder.getById.useQuery(
      { id: id! },
      { enabled: !!id && !!currentCompany?.id }
    );

  const confirmMutation = trpc.salesOrder.confirm.useMutation({
    onSuccess: () => utils.salesOrder.getById.invalidate({ id: id! }),
  });

  const cancelMutation = trpc.salesOrder.cancel.useMutation({
    onSuccess: () => utils.salesOrder.getById.invalidate({ id: id! }),
  });

  // TODO: Add ship mutation when available in router
  // const shipMutation = trpc.salesOrder.ship.useMutation({
  //   onSuccess: () => utils.salesOrder.getById.invalidate({ id: id! }),
  // });

  // Removed direct createInvoiceMutation in favor of Modal

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

  const handleShip = async () => {
    if (!order) return;
    // Open modal instead of direct mutation for partial shipping support
    setShipmentModalOpen(true);
  };

  const handleCreateInvoice = () => {
    if (!order) return;
    setIsInvoiceModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800';
      case 'PARTIALLY_SHIPPED':
        return 'bg-amber-100 text-amber-800';
      case 'SHIPPED':
        return 'bg-teal-100 text-teal-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getShipmentStatus = (status: string) => {
    if (status === 'SHIPPED' || status === 'COMPLETED')
      return {
        label: 'Fully Shipped',
        color: 'text-green-600 bg-green-50',
      };
    if (status === 'PARTIALLY_SHIPPED')
      return {
        label: 'Partial',
        color: 'text-amber-600 bg-amber-50',
      };
    if (status === 'CONFIRMED')
      return {
        label: 'Pending',
        color: 'text-blue-600 bg-blue-50',
      };
    if (status === 'CANCELLED')
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

  const shipmentStatus = getShipmentStatus(order.status);

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
          // Optionally navigate to invoice, or just let user see "View Invoice" button
          navigate(`/invoices/${invoiceId}`);
        }}
      />

      <div className="space-y-6">
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
          <div className="flex gap-2">
            <span
              className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full items-center ${getStatusColor(order.status)}`}
            >
              {order.status}
            </span>
          </div>
        </div>

        {/* Details Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">
            Order Details
          </h2>
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
              <p className="text-sm text-gray-500">Shipment Status</p>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${shipmentStatus.color}`}
              >
                {shipmentStatus.label}
              </span>
            </div>
          </div>

          <hr className="my-6" />

          <div>
            <p className="text-sm text-gray-500 mb-2">Total Amount</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(Number(order.totalAmount))}
            </p>
          </div>
        </div>

        {/* Items Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Order Items</h2>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Product
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Quantity
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Unit Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-right">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(Number(item.price))}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(
                      item.quantity * Number(item.price)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Actions</h2>
          <div className="flex flex-wrap gap-3">
            {order.status === 'DRAFT' && (
              <>
                <ActionButton
                  variant="primary"
                  onClick={handleConfirm}
                >
                  Confirm Order
                </ActionButton>
                <ActionButton variant="danger" onClick={handleCancel}>
                  Cancel Order
                </ActionButton>
              </>
            )}
            {(order.status === 'CONFIRMED' ||
              order.status === 'PARTIALLY_SHIPPED') && (
              <ActionButton variant="success" onClick={handleShip}>
                Ship Order
              </ActionButton>
            )}
            {(order.status === 'SHIPPED' ||
              order.status === 'PARTIALLY_SHIPPED' ||
              order.status === 'COMPLETED') &&
              (!order.invoices || order.invoices.length === 0) && (
                <ActionButton
                  variant="primary"
                  onClick={handleCreateInvoice}
                >
                  Create Invoice
                </ActionButton>
              )}
            {order.invoices && order.invoices.length > 0 && (
              <ActionButton
                variant="secondary"
                onClick={() =>
                  navigate(`/invoices/${order.invoices![0].id}`)
                }
              >
                View Invoice
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
