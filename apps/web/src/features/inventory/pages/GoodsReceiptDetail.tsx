import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { trpc } from '@/lib/trpc';
import { formatCurrency, formatDate } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/ConfirmModal';
import CreateBillModal from '@/features/accounting/components/CreateBillModal';
import { PageContainer } from '@/components/layout/PageLayout';
import { DocumentStatusSchema } from '@sync-erp/shared';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  PageHeader,
  StatusBadge,
  LoadingState,
  EmptyState,
} from '@/components/ui';

export default function GoodsReceiptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const utils = trpc.useUtils();
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);

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

    // FR-024: Prompt for void reason
    const reason = window.prompt(
      'Please enter a reason for voiding this goods receipt:'
    );
    if (!reason || reason.trim().length === 0) {
      return; // User cancelled
    }

    const confirmed = await confirm({
      title: 'Void Goods Receipt',
      message:
        'This will reverse the inventory update and journal entries. Are you sure?',
      confirmText: 'Yes, Void',
      variant: 'danger',
    });

    if (confirmed) {
      try {
        await voidMutation.mutateAsync({ id: receipt.id, reason });
      } catch (error) {
        console.error('Failed to void GRN:', error);
      }
    }
  };

  const handleCreateBill = () => {
    if (!receipt) return;
    setIsBillModalOpen(true);
  };

  if (error) {
    console.error('Failed to load goods receipt:', error);
    navigate('/receipts');
    return null;
  }

  if (loading || !currentCompany) {
    return <LoadingState />;
  }

  if (!receipt) {
    return (
      <EmptyState message="Goods Receipt not found or access denied." />
    );
  }

  const totalValue = receipt.items.reduce(
    (sum, item) =>
      sum +
      Number(item.quantity) * Number(item.orderItem?.price || 0),
    0
  );

  return (
    <PageContainer>
      {/* Header */}
      <PageHeader
        title={receipt.number}
        subtitle="Goods Receipt Note"
        badges={
          <StatusBadge status={receipt.status} domain="document" />
        }
        actions={
          <>
            {receipt.status === DocumentStatusSchema.enum.DRAFT && (
              <Button
                onClick={handlePost}
                disabled={postMutation.isPending}
              >
                Post Receipt
              </Button>
            )}
            {receipt.status === DocumentStatusSchema.enum.POSTED && (
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
          </>
        }
      />

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Receipt Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">GRN Number</p>
              <p className="font-mono font-medium">
                {receipt.number}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Purchase Order</p>
              <p className="font-medium">
                {receipt.order ? (
                  <Link
                    to={`/purchase-orders/${receipt.orderId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {receipt.order.orderNumber}
                  </Link>
                ) : (
                  '-'
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="font-medium">
                {formatDate(receipt.date)}
              </p>
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
        </CardContent>
      </Card>

      {/* Items Card */}
      <Card>
        <CardHeader>
          <CardTitle>Received Items</CardTitle>
        </CardHeader>
        <CardContent>
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
                      Number(item.orderItem?.price || 0)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(
                      Number(item.quantity) *
                        Number(item.orderItem?.price || 0)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Bill Modal */}
      <CreateBillModal
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        grnId={receipt.id}
        onSuccess={(billId) => {
          utils.inventory.getGRN.invalidate({ id: id! });
          navigate(`/bills/${billId}`);
        }}
      />
    </PageContainer>
  );
}
