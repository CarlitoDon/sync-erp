import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCompanyData } from '../../../hooks/useCompanyData';
import { apiAction } from '../../../hooks/useApiAction';
import { useConfirm } from '../../../components/ui/ConfirmModal';
import ActionButton from '../../../components/ui/ActionButton';
import {
  salesOrderService,
  SalesOrder,
} from '../services/salesOrderService';
import { invoiceService } from '../../finance/services/invoiceService';
import { formatCurrency } from '../../../utils/format';

interface SalesOrderListProps {
  filter?: { partnerId?: string; status?: string };
}

export default function SalesOrderList({
  filter,
}: SalesOrderListProps) {
  const confirm = useConfirm();

  const {
    data: orders,
    loading,
    refresh: loadData,
  } = useCompanyData<SalesOrder[]>(async () => {
    return await salesOrderService.list(filter);
  }, []);

  // Reload when filter changes
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filter)]);

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

  const getInvoiceStatusBadge = (status: string, balance: number) => {
    const formatCompact = (val: number) => {
      if (val >= 1000000000)
        return `${(val / 1000000000).toFixed(1)}B`;
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
      return val.toFixed(0);
    };

    switch (status) {
      case 'PAID':
        return {
          color: 'bg-green-100 text-green-800',
          label: '✓ Paid',
        };
      case 'POSTED':
        return {
          color: 'bg-yellow-100 text-yellow-800',
          label:
            balance > 0
              ? `○ Rp ${formatCompact(balance)}`
              : '○ Posted',
        };
      case 'VOID':
        return { color: 'bg-red-100 text-red-800', label: '✕ Void' };
      default:
        return {
          color: 'bg-gray-100 text-gray-600',
          label: '◌ Draft',
        };
    }
  };

  const handleConfirm = async (id: string) => {
    await apiAction(
      () => salesOrderService.confirm(id),
      'Order confirmed!'
    );
    loadData();
  };

  const handleShip = async (id: string) => {
    await apiAction(
      () => salesOrderService.ship(id),
      'Order shipped!'
    );
    loadData();
  };

  const handleCreateInvoice = async (orderId: string) => {
    const result = await apiAction(
      () => invoiceService.createFromSO(orderId),
      'Invoice created!'
    );
    if (result) {
      loadData();
    }
  };

  const handleViewInvoice = (invoiceId: string) => {
    window.location.href = `/invoices/${invoiceId}`;
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
      () => salesOrderService.cancel(id),
      'Order cancelled'
    );
    loadData();
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
              SO Number
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Customer
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
                No sales orders found.
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-sm">
                  <Link
                    to={`/sales-orders/${order.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <Link
                    to={`/customers/${order.partnerId}`}
                    className="text-gray-900 hover:text-blue-600 hover:underline"
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
                  {order.status === 'DRAFT' && (
                    <>
                      <ActionButton
                        onClick={() => handleConfirm(order.id)}
                        variant="primary"
                      >
                        Confirm
                      </ActionButton>
                      <ActionButton
                        onClick={() => handleCancel(order.id)}
                        variant="danger"
                      >
                        Cancel
                      </ActionButton>
                    </>
                  )}
                  {order.status === 'CONFIRMED' && (
                    <ActionButton
                      onClick={() => handleShip(order.id)}
                      variant="success"
                    >
                      Ship
                    </ActionButton>
                  )}
                  {order.status === 'COMPLETED' &&
                    (!order.invoices ||
                      order.invoices.length === 0) && (
                      <ActionButton
                        onClick={() => handleCreateInvoice(order.id)}
                        variant="warning"
                      >
                        Inv (+Tax)
                      </ActionButton>
                    )}
                  {order.status === 'COMPLETED' &&
                    order.invoices &&
                    order.invoices.length > 0 && (
                      <div className="flex flex-col items-end gap-1">
                        <ActionButton
                          onClick={() =>
                            handleViewInvoice(order.invoices![0].id)
                          }
                          variant="secondary"
                        >
                          View Invoice
                        </ActionButton>
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${getInvoiceStatusBadge(order.invoices![0].status, Number(order.invoices![0].balance)).color}`}
                        >
                          {
                            getInvoiceStatusBadge(
                              order.invoices![0].status,
                              Number(order.invoices![0].balance)
                            ).label
                          }
                        </span>
                      </div>
                    )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
