import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { PageContainer } from '@/components/layout/PageLayout';
import {
  ActionButton,
  BackButton,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatusBadge,
  LoadingState,
  EmptyState,
} from '@/components/ui';
import UnitAssignmentModal from '../modals/UnitAssignmentModal';
import CancelOrderModal from '../modals/CancelOrderModal';
import ConfirmOrderModal from '../modals/ConfirmOrderModal';
import ReturnModal from '../modals/ReturnModal';
import { RentalOrderStatus, OrderSource } from '@sync-erp/shared';
import {
  UserIcon,
  TruckIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

export default function RentalOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  const { data: order, isLoading } =
    trpc.rental.orders.getById.useQuery(
      { id: id! },
      { enabled: !!id && !!currentCompany?.id }
    );

  if (isLoading) return <LoadingState />;
  if (!order) return <EmptyState message="Rental Order not found" />;

  const handleConfirm = () => {
    setIsConfirmModalOpen(true);
  };

  const handleCancelOrder = () => {
    setIsCancelModalOpen(true);
  };

  // Safe type casting or checking
  const isConfirmed = order.status === RentalOrderStatus.CONFIRMED;
  const isActive = order.status === RentalOrderStatus.ACTIVE;
  const isDraft = order.status === RentalOrderStatus.DRAFT;

  // Assignments Logic - order already has correct type from TRPC
  const assignments = order.unitAssignments ?? [];
  const assignedUnitsCount = assignments.length;
  
  // For bundle orders, count component units needed, not just item quantity
  const totalUnitsRequired = order.items.reduce((sum, item) => {
    if (item.rentalBundleId && item.rentalBundle?.components) {
      // Bundle: count each component * bundle quantity
      return sum + item.rentalBundle.components.length * item.quantity;
    }
    // Regular item: just quantity
    return sum + item.quantity;
  }, 0);

  return (
    <>
      <UnitAssignmentModal
        isOpen={isReleaseModalOpen}
        onClose={() => setIsReleaseModalOpen(false)}
        order={order}
        onSuccess={() => {
          utils.rental.orders.getById.invalidate({ id: id! });
          setIsReleaseModalOpen(false);
        }}
      />

      <CancelOrderModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        orderId={order.id}
        orderNumber={order.orderNumber}
        onSuccess={() => setIsCancelModalOpen(false)}
      />

      <ReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        order={order}
        onSuccess={() => {
          utils.rental.orders.getById.invalidate({ id: id! });
          setIsReturnModalOpen(false);
        }}
      />

      <ConfirmOrderModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        order={order}
        onSuccess={() => {
          utils.rental.orders.getById.invalidate({ id: id! });
          setIsConfirmModalOpen(false);
        }}
      />

      <PageContainer>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {order.orderNumber}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <UserIcon className="w-4 h-4" />
                <span>
                  {order.partner?.name || 'Unknown Customer'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {order.orderSource === OrderSource.WEBSITE ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700" title="Order dari Santi Living">
                <GlobeAltIcon className="w-3.5 h-3.5" />
                Website
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600" title="Order dibuat manual">
                <ComputerDesktopIcon className="w-3.5 h-3.5" />
                Manual
              </span>
            )}
            <StatusBadge status={order.status} domain="rental" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Col */}
          <div className="lg:col-span-2 space-y-6">
            {/* Rental Period & Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Rental Period</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-600 uppercase font-semibold mb-1">
                      Start Date
                    </p>
                    <p className="font-medium text-gray-900">
                      {formatDateTime(order.rentalStartDate)}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <p className="text-xs text-purple-600 uppercase font-semibold mb-1">
                      End Date
                    </p>
                    <p className="font-medium text-gray-900">
                      {formatDateTime(order.rentalEndDate)}
                    </p>
                  </div>
                </div>
                {/* Progress Bar could go here */}
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle>Rental Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          Product
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">
                          Qty
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">
                          Price
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {order.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900">
                                {item.rentalBundle?.name ||
                                  item.rentalItem?.product?.name ||
                                  'Unknown Product'}
                              </p>
                              {item.rentalBundle && (
                                <p className="text-sm text-gray-500">
                                  {item.rentalBundle.components
                                    ?.map((c) => c.rentalItem?.product?.name)
                                    .filter(Boolean)
                                    .join(', ')}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {formatCurrency(Number(item.unitPrice))}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatCurrency(Number(item.subtotal))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-medium">
                      <tr>
                        <td className="px-4 py-3" colSpan={3}>
                          Subtotal
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(Number(order.subtotal))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Unit Assignments */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Unit Assignments</CardTitle>
                <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded-full">
                  {assignedUnitsCount} / {totalUnitsRequired} Assigned
                </span>
              </CardHeader>
              <CardContent>
                {assignments.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-start gap-3 p-3 border rounded-lg hover:shadow-sm transition-shadow"
                      >
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                          <CheckCircleIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">
                            {assignment.rentalItemUnit?.unitCode}
                          </p>
                          <p className="text-xs text-gray-500">
                            {
                              assignment.rentalItemUnit?.rentalItem
                                ?.product?.name
                            }
                          </p>
                          <div className="flex gap-2 mt-1">
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                              {assignment.rentalItemUnit?.condition}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                    No units assigned yet. Confirmed orders will
                    reserve units.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Right Col */}
          <div className="space-y-6">
            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isDraft && (
                  <ActionButton
                    variant="primary"
                    className="w-full"
                    onClick={handleConfirm}
                  >
                    Confirm Order
                  </ActionButton>
                )}

                {isConfirmed && (
                  <div className="space-y-2">
                    <ActionButton
                      variant="primary"
                      className="w-full flex justify-center gap-2"
                      onClick={() => setIsReleaseModalOpen(true)}
                    >
                      <TruckIcon className="w-4 h-4" />
                      Release Units (Serah Terima)
                    </ActionButton>
                    <p className="text-xs text-gray-500 text-center">
                      Serahkan unit ke customer untuk memulai masa
                      sewa.
                    </p>
                  </div>
                )}

                {isActive && (
                  <ActionButton
                    variant="primary"
                    className="w-full"
                    onClick={() => setIsReturnModalOpen(true)}
                  >
                    Return Units (Kembalikan)
                  </ActionButton>
                )}

                {isDraft && (
                  <ActionButton
                    variant="destructive"
                    className="w-full"
                    onClick={handleCancelOrder}
                  >
                    Cancel Order
                  </ActionButton>
                )}

                <hr className="border-gray-100" />

                <ActionButton
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    toast('Invoice feature coming soon');
                  }}
                >
                  Create Invoice
                </ActionButton>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Amount</span>
                  <span className="font-medium">
                    {formatCurrency(Number(order.totalAmount))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Deposit Amount
                  </span>
                  <span className="font-medium">
                    {formatCurrency(Number(order.depositAmount))}
                  </span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                  <span className="font-semibold text-gray-700">
                    Net Outstanding
                  </span>
                  {/* Simple placeholder logic for outstanding */}
                  <span className="font-bold text-gray-900">
                    {formatCurrency(Number(order.totalAmount))}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Meta Info */}
            <Card>
              <CardContent className="pt-6 space-y-4 text-sm text-gray-500">
                <div>
                  <label className="block text-xs uppercase text-gray-400 mb-1">
                    Created At
                  </label>
                  <p>{formatDateTime(order.createdAt)}</p>
                </div>
                <div>
                  <label className="block text-xs uppercase text-gray-400 mb-1">
                    Last Updated
                  </label>
                  <p>{formatDateTime(order.updatedAt)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
