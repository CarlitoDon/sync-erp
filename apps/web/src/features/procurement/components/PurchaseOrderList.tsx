import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm } from '@/components/ui/ConfirmModal';
import PurchaseOrderActions from './PurchaseOrderActions';
import { GoodsReceiptModal } from '@/features/inventory/components/GoodsReceiptModal';
import CreateBillModal from '@/features/accounting/components/CreateBillModal';
import { formatCurrency } from '@/utils/format';

interface PurchaseOrderListProps {
  filter?: { partnerId?: string; status?: string };
}

export default function PurchaseOrderList({
  filter,
}: PurchaseOrderListProps) {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();
  const [goodsReceiptId, setGoodsReceiptId] = useState<string | null>(
    null
  );
  const [createBillOrderId, setCreateBillOrderId] = useState<
    string | null
  >(null);

  const { data: orders = [], isLoading: loading } =
    trpc.purchaseOrder.list.useQuery(filter, {
      enabled: !!currentCompany?.id,
    });

  const confirmMutation = trpc.purchaseOrder.confirm.useMutation({
    onSuccess: () => utils.purchaseOrder.list.invalidate(),
  });

  const cancelMutation = trpc.purchaseOrder.cancel.useMutation({
    onSuccess: () => utils.purchaseOrder.list.invalidate(),
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800';
      case 'PARTIALLY_RECEIVED':
        return 'bg-amber-100 text-amber-800';
      case 'RECEIVED':
        return 'bg-teal-100 text-teal-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleConfirm = async (id: string) => {
    await apiAction(
      () => confirmMutation.mutateAsync({ id }),
      'Order confirmed!'
    );
  };

  const handleGoodsReceipt = (id: string) => {
    setGoodsReceiptId(id);
  };

  const handleCancel = async (id: string) => {
    const confirmed = await confirm({
      title: 'Cancel Order',
      message: 'Are you sure you want to cancel this order?',
      confirmText: 'Yes, Cancel',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () => cancelMutation.mutateAsync({ id }),
      'Order cancelled'
    );
  };

  const handleCreateBill = (orderId: string) => {
    setCreateBillOrderId(orderId);
  };

  const handleViewBill = (billId: string) => {
    navigate(`/bills/${billId}`);
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              PO Number
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Supplier
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Total
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {orders.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-6 py-12 text-center text-gray-500"
              >
                No purchase orders found.
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-sm">
                  <Link
                    to={`/purchase-orders/${order.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <Link
                    to={`/suppliers/${order.partnerId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {order.partner?.name || '-'}
                  </Link>
                </td>
                <td className="px-6 py-4 text-right">
                  {formatCurrency(Number(order.totalAmount))}
                </td>
                <td className="px-6 py-4 text-center">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}
                  >
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <PurchaseOrderActions
                    order={order}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                    onReceiveGoods={handleGoodsReceipt}
                    onCreateBill={handleCreateBill}
                    onViewBill={handleViewBill}
                    layout="list"
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {goodsReceiptId && (
        <GoodsReceiptModal
          isOpen={!!goodsReceiptId}
          onClose={() => setGoodsReceiptId(null)}
          purchaseOrderId={goodsReceiptId}
          orderItems={(
            orders.find((o) => o.id === goodsReceiptId)?.items || []
          ).map((item) => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            price: Number(item.price),
            product: item.product,
          }))}
          onSuccess={() => utils.purchaseOrder.list.invalidate()}
        />
      )}

      {/* Bill Creation Modal */}
      <CreateBillModal
        isOpen={createBillOrderId !== null}
        onClose={() => setCreateBillOrderId(null)}
        orderId={createBillOrderId || undefined}
        onSuccess={(billId) => {
          utils.purchaseOrder.list.invalidate();
          navigate(`/bills/${billId}`);
        }}
      />
    </div>
  );
}
