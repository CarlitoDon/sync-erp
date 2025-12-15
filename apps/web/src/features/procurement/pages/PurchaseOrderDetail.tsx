import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  purchaseOrderService,
  PurchaseOrder,
} from '../services/purchaseOrderService';
import { billService } from '../../finance/services/billService';
import { useCompany } from '../../../contexts/CompanyContext';
import { apiAction } from '../../../hooks/useApiAction';
import { useConfirm } from '../../../components/ui/ConfirmModal';
import ActionButton from '../../../components/ui/ActionButton';
import { formatCurrency, formatDate } from '../../../utils/format';
import { GoodsReceiptModal } from '../../inventory/components/GoodsReceiptModal';

// Extended PO type with bill info
interface POWithBill extends PurchaseOrder {
  bill?: { id: string; invoiceNumber: string } | null;
}

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const confirm = useConfirm();

  const [order, setOrder] = useState<POWithBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [goodsReceiptId, setGoodsReceiptId] = useState<string | null>(null);

  const loadOrder = async () => {
    if (!id || !currentCompany) return;
    setLoading(true);
    try {
      const data = await purchaseOrderService.getById(id);
      
      // Check if PO has a bill
      const bill = await billService.getByOrderId(id);
      
      setOrder({
        ...data,
        bill: bill ? { id: bill.id, invoiceNumber: bill.invoiceNumber || '' } : null,
      });
    } catch (error) {
      console.error('Failed to load order:', error);
      navigate('/purchase-orders');
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
      () => purchaseOrderService.confirm(order.id),
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
      () => purchaseOrderService.cancel(order.id),
      'Order cancelled'
    );
    loadOrder();
  };

  const handleCreateBill = async () => {
    if (!order) return;
    const result = await apiAction(
      () => billService.createFromPO(order.id),
      'Bill created from Purchase Order!'
    );
    if (result) {
      setOrder(prev => prev ? {
        ...prev,
        bill: { id: result.id, invoiceNumber: result.invoiceNumber || '' }
      } : null);
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

  return (
    <>
      {/* Goods Receipt Modal */}
      <GoodsReceiptModal
        isOpen={goodsReceiptId !== null}
        purchaseOrderId={goodsReceiptId || ''}
        onClose={() => setGoodsReceiptId(null)}
        onSuccess={() => {
          setGoodsReceiptId(null);
          loadOrder();
        }}
      />

      {/* Page Content */}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/purchase-orders')}
              className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
            >
              ← Back to Purchase Orders
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {order.orderNumber}
            </h1>
            <p className="text-gray-500">
              {order.partner?.name || 'Unknown Supplier'}
            </p>
          </div>
          <span
            className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(order.status)}`}
          >
            {order.status}
          </span>
        </div>

        {/* Details Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Order Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">Order Number</p>
              <p className="font-mono font-medium">{order.orderNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Supplier</p>
              <p className="font-medium">{order.partner?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="font-medium">{formatDate(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Related Bill</p>
              {order.bill ? (
                <Link
                  to={`/bills/${order.bill.id}`}
                  className="font-mono font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {order.bill.invoiceNumber}
                </Link>
              ) : (
                <span className="text-gray-400 italic">No bill created</span>
              )}
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
                    {item.product?.name || item.productId}
                  </td>
                  <td className="px-4 py-3 text-right">{item.quantity}</td>
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
              <ActionButton
                variant="success"
                onClick={() => setGoodsReceiptId(order.id)}
              >
                Receive Goods
              </ActionButton>
            )}
            {order.status === 'COMPLETED' && !order.bill && (
              <ActionButton variant="primary" onClick={handleCreateBill}>
                Create Bill
              </ActionButton>
            )}
            {order.status === 'COMPLETED' && order.bill && (
              <ActionButton
                variant="secondary"
                onClick={() => navigate(`/bills/${order.bill!.id}`)}
              >
                View Bill ({order.bill.invoiceNumber})
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
