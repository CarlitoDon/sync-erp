import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  salesOrderService,
  SalesOrder,
} from '../services/salesOrderService';
import { invoiceService } from '../../finance/services/invoiceService';
import { useCompany } from '../../../contexts/CompanyContext';
import { apiAction } from '../../../hooks/useApiAction';
import { useConfirm } from '../../../components/ui/ConfirmModal';
import ActionButton from '../../../components/ui/ActionButton';
import { formatCurrency, formatDate } from '../../../utils/format';

export default function SalesOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const confirm = useConfirm();

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrder = async () => {
    if (!id || !currentCompany) return;
    setLoading(true);
    try {
      const data = await salesOrderService.getById(id);
      setOrder(data);
    } catch (error) {
      console.error('Failed to load order:', error);
      navigate('/sales-orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [id, currentCompany]);

  const handleConfirm = async () => {
    if (!order) return;
    await apiAction(
      () => salesOrderService.confirm(order.id),
      'Order confirmed!'
    );
    loadOrder();
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
      () => salesOrderService.cancel(order.id),
      'Order cancelled'
    );
    loadOrder();
  };

  const handleShip = async () => {
    if (!order) return;
    await apiAction(
      () => salesOrderService.ship(order.id),
      'Order shipped!'
    );
    loadOrder();
  };

  const handleCreateInvoice = async () => {
    if (!order) return;
    const result = await apiAction(
      () => invoiceService.createFromSO(order.id),
      'Invoice created from Sales Order!'
    );
    if (result) {
      loadOrder();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getShipmentStatus = (status: string) => {
    if (status === 'COMPLETED')
      return {
        label: 'Shipped',
        color: 'text-green-600 bg-green-50',
      };
    if (status === 'CONFIRMED')
      return {
        label: 'Pending',
        color: 'text-amber-600 bg-amber-50',
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/sales-orders')}
            className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
          >
            ← Back to Sales Orders
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {order.orderNumber}
          </h1>
          <p className="text-gray-500">
            {order.partner?.name || 'Unknown Customer'}
          </p>
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
        <h2 className="text-lg font-semibold mb-4">Order Details</h2>
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
                  {formatCurrency(item.quantity * Number(item.price))}
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
              <ActionButton variant="primary" onClick={handleConfirm}>
                Confirm Order
              </ActionButton>
              <ActionButton variant="danger" onClick={handleCancel}>
                Cancel Order
              </ActionButton>
            </>
          )}
          {order.status === 'CONFIRMED' && (
            <ActionButton variant="success" onClick={handleShip}>
              Ship Order
            </ActionButton>
          )}
          {order.status === 'COMPLETED' &&
            (!order.invoices || order.invoices.length === 0) && (
              <ActionButton
                variant="warning"
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
  );
}
