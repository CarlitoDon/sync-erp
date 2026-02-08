import { useParams } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { formatDateTime } from '@/utils/format';
import { PageContainer } from '@/components/layout/PageLayout';
import {
  BackButton,
  Card,
  CardContent,
  StatusBadge,
  LoadingState,
  EmptyState,
} from '@/components/ui';

import UnitAssignmentModal from '../modals/UnitAssignmentModal';
import CancelOrderModal from '../modals/CancelOrderModal';
import ConfirmOrderModal from '../modals/ConfirmOrderModal';
import ReturnModal from '../modals/ReturnModal';
import VerifyPaymentModal from '../modals/VerifyPaymentModal';
import { OrderSource } from '@sync-erp/shared';
import {
  UserIcon,
  GlobeAltIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline';
import { useRentalOrderModals } from '../hooks/useRentalOrderModals';
import { useRentalOrderPermissions } from '../hooks/useRentalOrderPermissions';
import { useRentalOrderCalculations } from '../hooks/useRentalOrderCalculations';
import { RentalPeriodCard } from '../components/RentalPeriodCard';
import { RentalItemsTable } from '../components/RentalItemsTable';
import { UnitAssignmentsCard } from '../components/UnitAssignmentsCard';
import { RentalActionsCard } from '../components/RentalActionsCard';
import { RentalFinancialSummary } from '../components/RentalFinancialSummary';
import { RentalPaymentStatusCard } from '../components/RentalPaymentStatusCard';

export default function RentalOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentCompany } = useCompany();
  const modals = useRentalOrderModals(id);

  const { data: order, isLoading } =
    trpc.rental.orders.getById.useQuery(
      { id: id! },
      { enabled: !!id && !!currentCompany?.id }
    );

  const permissions = useRentalOrderPermissions(order);
  const calculations = useRentalOrderCalculations(order);

  if (isLoading) return <LoadingState />;
  if (!order) return <EmptyState message="Rental Order not found" />;

  const handleConfirm = () => modals.confirm.open();
  const handleCancelOrder = () => modals.cancel.open();
  const handleRelease = () => modals.release.open();
  const handleReturn = () => modals.return.open();

  return (
    <>
      <UnitAssignmentModal
        isOpen={modals.release.isOpen}
        onClose={modals.release.close}
        order={order}
        onSuccess={modals.release.onSuccess}
      />

      <CancelOrderModal
        isOpen={modals.cancel.isOpen}
        onClose={modals.cancel.close}
        orderId={order.id}
        orderNumber={order.orderNumber}
        onSuccess={modals.cancel.onSuccess}
      />

      <ReturnModal
        isOpen={modals.return.isOpen}
        onClose={modals.return.close}
        order={order}
        onSuccess={modals.return.onSuccess}
      />

      <ConfirmOrderModal
        isOpen={modals.confirm.isOpen}
        onClose={modals.confirm.close}
        orderId={id ?? null}
        onSuccess={modals.confirm.onSuccess}
      />

      <VerifyPaymentModal
        isOpen={modals.verifyPayment.isOpen}
        onClose={modals.verifyPayment.close}
        order={order}
        onSuccess={modals.verifyPayment.onSuccess}
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
              <span
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700"
                title="Order dari Santi Living"
              >
                <GlobeAltIcon className="w-3.5 h-3.5" />
                Website
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600"
                title="Order dibuat manual"
              >
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
            <RentalPeriodCard
              startDate={order.rentalStartDate}
              endDate={order.rentalEndDate}
              calculations={calculations}
            />

            <RentalItemsTable
              items={order.items.map((item) => ({
                ...item,
                unitPrice: Number(item.unitPrice),
                subtotal: Number(item.subtotal),
                rentalBundle: item.rentalBundle
                  ? {
                      name: item.rentalBundle.name,
                      components:
                        item.rentalBundle.components?.map((c) => ({
                          rentalItem: c.rentalItem
                            ? {
                                product: c.rentalItem.product
                                  ? {
                                      name: c.rentalItem.product.name,
                                    }
                                  : undefined,
                              }
                            : undefined,
                        })) || [],
                    }
                  : null,
              }))}
              calculations={calculations}
            />

            <UnitAssignmentsCard
              assignments={order.unitAssignments ?? []}
              calculations={calculations}
            />
          </div>

          {/* Sidebar - Right Col */}
          <div className="space-y-6">
            {permissions.isWebsiteOrder && (
              <RentalPaymentStatusCard
                rentalPaymentStatus={order.rentalPaymentStatus}
                paymentClaimedAt={order.paymentClaimedAt}
                paymentConfirmedAt={order.paymentConfirmedAt}
                paymentReference={order.paymentReference}
                paymentFailReason={order.paymentFailReason}
                permissions={permissions}
                onVerifyPayment={modals.verifyPayment.open}
              />
            )}

            <RentalActionsCard
              permissions={permissions}
              onConfirm={handleConfirm}
              onRelease={handleRelease}
              onReturn={handleReturn}
              onCancel={handleCancelOrder}
            />

            <RentalFinancialSummary calculations={calculations} />

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
