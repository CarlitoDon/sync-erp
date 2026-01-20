import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { trpc } from '@/lib/trpc';
import { formatCurrency, formatDate } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { usePrompt } from '@/components/ui/PromptModal';
import { BackButton } from '@/components/ui/BackButton';
import CreateInvoiceModal from '@/features/accounting/components/CreateInvoiceModal';
import { PageContainer } from '@/components/layout/PageLayout';
import { DocumentStatusSchema } from '@sync-erp/shared';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/Card';
import { LoadingState } from '@/components/ui';

export default function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const utils = trpc.useUtils();
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  const {
    data: shipment,
    isLoading: loading,
    error,
  } = trpc.inventory.getShipment.useQuery(
    { id: id! },
    { enabled: !!id && !!currentCompany?.id }
  );

  const postMutation = trpc.inventory.postShipment.useMutation({
    onSuccess: () =>
      utils.inventory.getShipment.invalidate({ id: id! }),
  });

  // TODO: Add voidShipment mutation when available in backend
  const voidMutation = trpc.inventory.voidShipment.useMutation({
    onSuccess: () => {
      utils.inventory.getShipment.invalidate({ id: id! });
      utils.inventory.listShipments.invalidate();
    },
  });

  const deleteMutation = trpc.inventory.deleteShipment.useMutation({
    onSuccess: () => {
      utils.inventory.listShipments.invalidate();
      navigate('/shipments');
    },
  });

  const handlePost = async () => {
    if (!shipment) return;

    const confirmed = await confirm({
      title: 'Post Shipment',
      message:
        'This will update inventory levels (deduct stock) and cannot be undone. Are you sure?',
      confirmText: 'Yes, Post',
    });

    if (confirmed) {
      await postMutation.mutateAsync({ id: shipment.id });
    }
  };

  const handleVoid = async () => {
    if (!shipment) return;

    // FR-024: Prompt for void reason (accessible modal)
    const reason = await prompt({
      title: 'Void Shipment',
      message: 'Please enter a reason for voiding this shipment:',
      placeholder: 'Enter reason...',
      required: true,
    });
    if (!reason) {
      return; // User cancelled
    }

    const confirmed = await confirm({
      title: 'Void Shipment',
      message:
        'This will reverse the inventory update and journal entries. Are you sure?',
      confirmText: 'Yes, Void',
      variant: 'danger',
    });

    if (confirmed) {
      try {
        await voidMutation.mutateAsync({ id: shipment.id, reason });
      } catch (error) {
        console.error('Failed to void Shipment:', error);
      }
    }
  };

  const handleDelete = async () => {
    if (!shipment) return;

    const confirmed = await confirm({
      title: 'Delete Draft Shipment',
      message:
        'Are you sure you want to delete this draft shipment? This action cannot be undone.',
      confirmText: 'Yes, Delete',
      variant: 'danger',
    });

    if (confirmed) {
      try {
        await deleteMutation.mutateAsync({ id: shipment.id });
      } catch (error) {
        console.error('Failed to delete Shipment:', error);
      }
    }
  };

  const handleCreateInvoice = () => {
    if (!shipment) return;
    setIsInvoiceModalOpen(true);
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
    console.error('Failed to load shipment:', error);
    navigate('/shipments');
    return null;
  }

  if (loading || !currentCompany) {
    return <LoadingState />;
  }

  if (!shipment) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Shipment not found</div>
      </div>
    );
  }

  const totalCOGS = shipment.items.reduce(
    (sum, item) =>
      sum + Number(item.quantity) * Number(item.costSnapshot || 0),
    0
  );

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {shipment.number}
              </h1>
              <span
                className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(shipment.status)}`}
              >
                {shipment.status}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Shipment / Delivery Note
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {shipment.status === DocumentStatusSchema.enum.DRAFT && (
            <>
              <Button
                onClick={handlePost}
                disabled={postMutation.isPending}
              >
                Post Shipment
              </Button>
              <Button
                onClick={handleDelete}
                variant="danger"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </>
          )}
          {shipment.status === DocumentStatusSchema.enum.POSTED && (
            <>
              <Button onClick={handleCreateInvoice} variant="outline">
                Create Invoice
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
      <Card>
        <CardHeader>
          <CardTitle>Shipment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">Shipment Number</p>
              <p className="font-mono font-medium">
                {shipment.number}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Sales Order</p>
              <p className="font-medium">
                {shipment.order ? (
                  <Link
                    to={`/sales-orders/${shipment.orderId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {shipment.order.orderNumber}
                  </Link>
                ) : (
                  '-'
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="font-medium">
                {formatDate(shipment.date)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total COGS</p>
              <p className="font-medium text-primary-600">
                {formatCurrency(totalCOGS)}
              </p>
            </div>
          </div>
          {shipment.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">Notes</p>
              <p className="text-gray-700">{shipment.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items Card */}
      <Card>
        <CardHeader>
          <CardTitle>Shipped Items</CardTitle>
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
                  Unit Cost (COGS)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Total COGS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {shipment.items.map(
                (item: {
                  id: string;
                  productId: string;
                  quantity: number | { toNumber: () => number };
                  costSnapshot?:
                    | number
                    | { toNumber: () => number }
                    | null;
                  product?: { name: string };
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
                      {formatCurrency(Number(item.costSnapshot || 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(
                        Number(item.quantity) *
                          Number(item.costSnapshot || 0)
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Invoice Modal */}
      <CreateInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        shipmentId={shipment.id}
        onSuccess={(invoiceId) => {
          utils.inventory.getShipment.invalidate({ id: id! });
          navigate(`/invoices/${invoiceId}`);
        }}
      />
    </PageContainer>
  );
}
