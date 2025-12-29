import { Link, useNavigate } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { useOrderMutations } from '@/hooks/useOrderMutations';
import { apiAction } from '@/hooks/useApiAction';
import { formatCurrency } from '@/utils/format';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { usePrompt } from '@/components/ui/PromptModal';
import { LoadingState } from '@/components/ui';
import SalesOrderActions from './SalesOrderActions';

interface SalesOrderListProps {
  filter?: { partnerId?: string; status?: string };
}

export default function SalesOrderList({
  filter,
}: SalesOrderListProps) {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const prompt = usePrompt();

  const { data: orders = [], isLoading: loading } =
    trpc.salesOrder.list.useQuery(filter, {
      enabled: !!currentCompany?.id,
    });

  const { handleConfirm, handleCancel } = useOrderMutations({
    type: 'sales',
    onSuccess: () => utils.salesOrder.list.invalidate(),
  });

  const shipMutation = trpc.salesOrder.ship.useMutation({
    onSuccess: () => utils.salesOrder.list.invalidate(),
  });

  const closeMutation = trpc.salesOrder.close.useMutation({
    onSuccess: () => utils.salesOrder.list.invalidate(),
  });

  const createInvoiceMutation = trpc.invoice.createFromSO.useMutation(
    {
      onSuccess: () => {
        utils.salesOrder.list.invalidate();
        utils.invoice.list.invalidate();
      },
    }
  );

  const handleShip = async (id: string) => {
    await apiAction(
      () => shipMutation.mutateAsync({ id }),
      'Order shipped!'
    );
  };

  const handleCreateInvoice = async (orderId: string) => {
    await apiAction(
      () => createInvoiceMutation.mutateAsync({ orderId }),
      'Invoice created!'
    );
  };

  const handleViewInvoice = (invoiceId: string) => {
    navigate(`/invoices/${invoiceId}`);
  };

  const handleCloseSO = async (orderId: string) => {
    const reason = await prompt({
      title: 'Close Sales Order',
      message: 'Please enter a reason for closing this SO:',
      placeholder: 'Enter reason...',
      required: true,
    });

    if (!reason) return;

    const confirmed = await confirm({
      title: 'Close Sales Order',
      message:
        'This will close the sales order and prevent further shipment. Continue?',
      confirmText: 'Yes, Close',
      variant: 'danger',
    });

    if (!confirmed) return;

    await apiAction(
      () => closeMutation.mutateAsync({ id: orderId, reason }),
      'Sales order closed'
    );
  };

  if (loading && orders.length === 0) {
    return <LoadingState size="md" />;
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
                  <StatusBadge status={order.status} domain="order" />
                </td>
                <td className="px-6 py-4 text-right">
                  <SalesOrderActions
                    order={order}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                    onShip={handleShip}
                    onCreateInvoice={handleCreateInvoice}
                    onViewInvoice={handleViewInvoice}
                    onCloseSO={handleCloseSO}
                    onViewShipment={(shipmentId) => navigate(`/deliveries/${shipmentId}`)}
                    layout="list"
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
