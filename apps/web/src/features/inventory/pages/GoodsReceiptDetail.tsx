import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import { trpc } from '@/lib/trpc';
import { formatCurrency, formatDate } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { BackButton } from '@/components/ui/BackButton';

export default function GoodsReceiptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const {
    data: receipt,
    isLoading: loading,
    error,
  } = trpc.inventory.getGRN.useQuery(
    { id: id! },
    { enabled: !!id && !!currentCompany?.id }
  );

  const postMutation = trpc.inventory.postGRN.useMutation({
    onSuccess: () => utils.inventory.getGRN.invalidate({ id: id! }),
  });

  const voidMutation = trpc.inventory.voidGRN.useMutation({
    onSuccess: () => {
      utils.inventory.getGRN.invalidate({ id: id! });
      utils.inventory.listGRN.invalidate();
    },
  });

  const handlePost = async () => {
    if (!receipt) return;

    const confirmed = await confirm({
      title: 'Post Goods Receipt',
      message:
        'This will update inventory levels and cannot be undone. Are you sure?',
      confirmText: 'Yes, Post',
    });

    if (confirmed) {
      await postMutation.mutateAsync({ id: receipt.id });
    }
  };

  const handleVoid = async () => {
    if (!receipt) return;

    const confirmed = await confirm({
      title: 'Void Goods Receipt',
      message:
        'This will reverse the inventory update and journal entries. Are you sure?',
      confirmText: 'Yes, Void',
      variant: 'danger',
    });

    if (confirmed) {
      try {
        await voidMutation.mutateAsync({ id: receipt.id });
      } catch (error) {
        console.error('Failed to void GRN:', error);
      }
    }
  };

  const handleCreateBill = () => {
    if (!receipt) return;
    navigate(`/bills/new?grnId=${receipt.id}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'POSTED':
        return 'bg-green-100 text-green-800';
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'VOIDED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (error) {
    console.error('Failed to load goods receipt:', error);
    navigate('/receipts');
    return null;
  }

  if (loading || !currentCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">
          Goods Receipt not found or access denied.
        </div>
      </div>
    );
  }

  const totalValue = receipt.items.reduce(
    (sum, item) =>
      sum +
      Number(item.quantity) *
        Number(item.purchaseOrderItem?.price || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton to="/receipts" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {receipt.number}
              </h1>
              <span
                className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(receipt.status)}`}
              >
                {receipt.status}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Goods Receipt Note
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {receipt.status === 'DRAFT' && (
            <Button
              onClick={handlePost}
              disabled={postMutation.isPending}
            >
              Post Receipt
            </Button>
          )}
          {receipt.status === 'POSTED' && (
            <>
              <Button onClick={handleCreateBill} variant="outline">
                Create Bill
              </Button>
              <Button
                onClick={handleVoid}
                variant="danger"
                disabled={voidMutation.isPending}
              >
                {voidMutation.isPending ? 'Voiding...' : 'Void'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Details Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">
          Receipt Details
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500">GRN Number</p>
            <p className="font-mono font-medium">{receipt.number}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Purchase Order</p>
            <p className="font-medium">
              {receipt.purchaseOrder ? (
                <Link
                  to={`/purchase-orders/${receipt.purchaseOrderId}`}
                  className="text-blue-600 hover:underline"
                >
                  {receipt.purchaseOrder.orderNumber}
                </Link>
              ) : (
                '-'
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Date</p>
            <p className="font-medium">{formatDate(receipt.date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Value</p>
            <p className="font-medium text-primary-600">
              {formatCurrency(totalValue)}
            </p>
          </div>
        </div>
        {receipt.notes && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">Notes</p>
            <p className="text-gray-700">{receipt.notes}</p>
          </div>
        )}
      </div>

      {/* Items Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Received Items</h2>
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
                Unit Cost
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {receipt.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  {item.product ? (
                    <Link
                      to={`/products/${item.productId}`}
                      className="text-blue-600 hover:underline"
                    >
                      {item.product.name}
                    </Link>
                  ) : (
                    item.productId
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {Number(item.quantity)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(
                    Number(item.purchaseOrderItem?.price || 0)
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatCurrency(
                    Number(item.quantity) *
                      Number(item.purchaseOrderItem?.price || 0)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
