import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import { LoadingState, NoCompanySelected } from '@/components/ui';
import { Card } from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/utils/format';
import {
  ExclamationTriangleIcon,
  ClockIcon,
  PhoneIcon,
  ArrowUturnLeftIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { RentalOrderStatus } from '@sync-erp/shared';

export default function OverduePage() {
  const { currentCompany } = useCompany();

  // Queries - extract items from paginated response
  const { data: ordersData, isLoading } =
    trpc.rental.orders.list.useQuery(undefined, {
      enabled: !!currentCompany?.id,
    });
  const orders = ordersData?.items ?? [];

  // Calculate overdue orders
  const overdueOrders = useMemo(() => {
    const now = new Date();
    return orders
      .filter((o) => {
        if (o.status !== RentalOrderStatus.ACTIVE) return false;
        const dueDate = new Date(o.dueDateTime);
        return now > dueDate;
      })
      .map((o) => {
        const dueDate = new Date(o.dueDateTime);
        const now = new Date();
        const daysLate = Math.ceil(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Estimate late fee (simplified - actual calculation is in backend)
        // Assuming 10% of daily rate per day late as rough estimate
        const estimatedLateFee =
          daysLate * ((Number(o.subtotal) * 0.1) / 30);

        return {
          ...o,
          daysLate,
          estimatedLateFee,
        };
      })
      .sort((a, b) => b.daysLate - a.daysLate); // Most overdue first
  }, [orders]);

  // Summary stats
  const stats = useMemo(() => {
    const totalOverdue = overdueOrders.length;
    const totalLateFees = overdueOrders.reduce(
      (sum, o) => sum + o.estimatedLateFee,
      0
    );
    const avgDaysLate =
      totalOverdue > 0
        ? Math.round(
            overdueOrders.reduce((sum, o) => sum + o.daysLate, 0) /
              totalOverdue
          )
        : 0;

    return { totalOverdue, totalLateFees, avgDaysLate };
  }, [overdueOrders]);

  if (isLoading) return <LoadingState />;
  if (!currentCompany)
    return (
      <NoCompanySelected message="Pilih perusahaan untuk melihat order terlambat." />
    );

  return (
    <PageContainer>
      <PageHeader
        title="Order Terlambat"
        description="Pantau dan kelola order rental yang terlambat dikembalikan"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Terlambat</p>
              <p className="text-2xl font-bold text-red-600">
                {stats.totalOverdue}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <ClockIcon className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">
                Rata-rata Keterlambatan
              </p>
              <p className="text-2xl font-bold text-orange-600">
                {stats.avgDaysLate} hari
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">💰</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Estimasi Denda</p>
              <p className="text-2xl font-bold text-yellow-600">
                {formatCurrency(stats.totalLateFees)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Overdue Orders List */}
      {overdueOrders.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircleIcon className="w-12 h-12 mx-auto text-green-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Tidak ada order terlambat
          </h3>
          <p className="text-gray-500">
            Semua order dikembalikan tepat waktu. Bagus!
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {overdueOrders.map((order) => (
            <Card
              key={order.id}
              className="p-4 border-l-4 border-red-500"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {/* Severity Indicator */}
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      order.daysLate > 7
                        ? 'bg-red-500'
                        : order.daysLate > 3
                          ? 'bg-orange-500'
                          : 'bg-yellow-500'
                    }`}
                  >
                    <span className="text-white font-bold text-lg">
                      {order.daysLate}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/rental/orders/${order.id}`}
                        className="font-semibold text-gray-900 hover:text-primary-600"
                      >
                        {order.orderNumber}
                      </Link>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          order.daysLate > 7
                            ? 'bg-red-100 text-red-800'
                            : order.daysLate > 3
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {order.daysLate} hari terlambat
                      </span>
                    </div>
                    <p className="text-gray-600">
                      {order.partner?.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      Jatuh tempo:{' '}
                      {formatDate(new Date(order.dueDateTime))}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Late Fee Estimate */}
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      Estimasi Denda
                    </p>
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(order.estimatedLateFee)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {order.partner?.phone && (
                      <a
                        href={`tel:${order.partner.phone}`}
                        className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        title="Hubungi Customer"
                      >
                        <PhoneIcon className="w-4 h-4" />
                      </a>
                    )}
                    <Link
                      to={`/rental/returns?orderId=${order.id}`}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      <ArrowUturnLeftIcon className="w-4 h-4" />
                      Proses Return
                    </Link>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="mt-3 pt-3 border-t flex gap-4 text-sm text-gray-600">
                {order.items?.map((item) => (
                  <span key={item.id}>
                    {item.quantity}x {item.rentalItem?.product?.name}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
