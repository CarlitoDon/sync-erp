import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { trpc } from '@/lib/trpc';
import { formatCurrency, formatDate } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { usePrompt } from '@/components/ui/PromptModal';
import CreateBillModal from '@/features/accounting/components/CreateBillModal';
import { PageContainer } from '@/components/layout/PageLayout';
import {
  DocumentStatusSchema,
  PaymentTermsSchema,
} from '@sync-erp/shared';
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
import { logger } from '@/lib/logger';

export default function GoodsReceiptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const prompt = usePrompt();
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

  const orderIdForBills = receipt?.orderId;
  const { data: allBills = [] } = trpc.bill.list.useQuery(undefined, {
    enabled: !!currentCompany?.id && !!orderIdForBills,
  });

  const postMutation = trpc.inventory.postGRN.useMutation({
    onSuccess: () => utils.inventory.getGRN.invalidate({ id: id! }),
  });

  const voidMutation = trpc.inventory.voidGRN.useMutation({
    onSuccess: () => {
      utils.inventory.getGRN.invalidate({ id: id! });
      utils.inventory.listGRN.invalidate();
    },
  });

  const deleteMutation = trpc.inventory.deleteGRN.useMutation({
    onSuccess: () => {
      utils.inventory.listGRN.invalidate();
      // Navigate back to receipts list after deletion
      navigate('/receipts');
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

      // GAP-004: COD payment reminder
      // Check if the linked order is COD - show payment reminder
      const order = receipt.order;
      if (order?.paymentTerms === PaymentTermsSchema.enum.COD) {
        const goToPayment = await confirm({
          title: 'COD Order - Pembayaran Jatuh Tempo',
          message:
            'Order ini COD dan pembayaran harus segera diterima. Mau lihat detail order untuk mencatat pembayaran?',
          confirmText: 'Lihat Order',
          cancelText: 'Nanti',
        });
        if (goToPayment && order.id) {
          // Navigate to PO detail which shows DP/Final Bills
          navigate(`/purchase-orders/${order.id}`);
        }
      }
    }
  };

  const handleVoid = async () => {
    if (!receipt) return;

    // FR-024: Prompt for void reason (accessible modal)
    const reason = await prompt({
      title: 'Void Goods Receipt',
      message:
        'Please enter a reason for voiding this goods receipt:',
      placeholder: 'Enter reason...',
      required: true,
    });
    if (!reason) {
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
        logger.error('Failed to void GRN', error);
      }
    }
  };

  const handleCreateBill = () => {
    if (!receipt) return;
    setIsBillModalOpen(true);
  };

  const handleDelete = async () => {
    if (!receipt) return;

    const confirmed = await confirm({
      title: 'Delete Draft GRN',
      message:
        'Are you sure you want to delete this draft goods receipt? This action cannot be undone.',
      confirmText: 'Yes, Delete',
      variant: 'danger',
    });

    if (confirmed) {
      try {
        await deleteMutation.mutateAsync({ id: receipt.id });
      } catch (error) {
        logger.error('Failed to delete GRN', error);
      }
    }
  };

  if (error) {
    logger.error('Failed to load goods receipt', error);
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

  // Fix: Use specific linked invoices from backend relationship (GRN -> Invoices)
  // instead of broad PO-based matching which includes unrelated bills.
  const linkedInvoiceIds =
    receipt?.invoices?.map((inv) => inv.id) || [];

  const relatedBills = allBills.filter((bill) =>
    linkedInvoiceIds.includes(bill.id)
  );

  return (
    <PageContainer>
      {/* Header */}
      <PageHeader
        title={receipt.number}
        showBackButton
        subtitle="Goods Receipt Note"
        badges={
          <StatusBadge status={receipt.status} domain="document" />
        }
        actions={
          <>
            {receipt.status === DocumentStatusSchema.enum.DRAFT && (
              <>
                <Button
                  onClick={handlePost}
                  disabled={postMutation.isPending}
                >
                  Post Receipt
                </Button>
                <Button
                  onClick={handleDelete}
                  variant="danger"
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending
                    ? 'Deleting...'
                    : 'Delete'}
                </Button>
              </>
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

      {/* Related Bills (helps resolve "Cannot void: A BILL exists" blocker) */}
      {relatedBills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Related Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {relatedBills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/bills/${bill.id}`}
                      className="text-blue-600 hover:underline font-mono font-medium"
                    >
                      {bill.invoiceNumber || bill.id}
                    </Link>
                    <div className="text-sm text-gray-500">
                      Status: {bill.status} • Balance:{' '}
                      {formatCurrency(Number(bill.balance || 0))}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/bills/${bill.id}`)}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              {receipt.items.map(
                (item: {
                  id: string;
                  productId: string;
                  quantity: number | { toNumber: () => number };
                  product?: { name: string };
                  orderItem?: {
                    price: number | { toNumber: () => number };
                  };
                }) => (
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
                )
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Bill Modal */}
      <CreateBillModal
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        fulfillmentId={receipt.id} // Feature 041: Changed from grnId
        onSuccess={(billId) => {
          utils.inventory.getGRN.invalidate({ id: id! });
          navigate(`/bills/${billId}`);
        }}
      />
    </PageContainer>
  );
}
