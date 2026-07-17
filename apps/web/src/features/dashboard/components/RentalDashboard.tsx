import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { DashboardKPIs } from './DashboardKPIs';
import { trpc } from '@/lib/trpc';
import { formatDate } from '@/utils/format';
import { useCompany } from '@/contexts/CompanyContext';

export function RentalDashboard() {
  const { currentCompany } = useCompany();
  const hasSelectedCompany = Boolean(currentCompany?.id);

  const dateRange = useMemo(() => {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }, []);

  const {
    data: orders,
    error: ordersError,
    isLoading: isOrdersLoading,
  } = trpc.rental.orders.list.useQuery(
    {
      status: 'ACTIVE',
      take: 5,
    },
    {
      enabled: hasSelectedCompany,
      retry: false,
    }
  );

  const {
    data: timeline,
    error: timelineError,
    isLoading: isTimelineLoading,
  } = trpc.rental.availability.timeline.useQuery(dateRange, {
    enabled: hasSelectedCompany,
    retry: false,
  });

  const upcomingBookings = useMemo(() => {
    if (!timeline) {
      return [];
    }

    return timeline.items
      .flatMap((item) => item.units)
      .flatMap((unit) => unit.bookings)
      .slice(0, 8);
  }, [timeline]);

  if (!hasSelectedCompany) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-slate-500">
            Select a company first to load rental dashboard data.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (ordersError || timelineError) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <p className="font-medium text-red-700">
            Error loading rental dashboard data
          </p>
          <p className="mt-1 text-sm text-red-600">
            {ordersError?.message || timelineError?.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const activeCount = orders?.items.length ?? 0;

  return (
    <div className="space-y-6">
      <DashboardKPIs />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              Upcoming Returns & Pickups ({formatDate(dateRange.endDate)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isTimelineLoading ? (
              <p className="text-sm text-slate-500">
                Loading timeline...
              </p>
            ) : upcomingBookings.length > 0 ? (
              <ul className="space-y-2">
                {upcomingBookings.map((booking) => (
                  <li
                    key={`${booking.orderId}-${booking.startDate.toString()}-${booking.endDate.toString()}`}
                    className="flex justify-between border-b border-slate-100 py-2 last:border-0"
                  >
                    <span className="text-sm font-medium text-slate-800">
                      {booking.partnerName} - {booking.orderNumber}
                    </span>
                    <span className="text-sm text-slate-500">
                      {formatDate(new Date(booking.endDate))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                No upcoming bookings found in the next 7 days.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Rentals</CardTitle>
          </CardHeader>
          <CardContent>
            {isOrdersLoading ? (
              <p className="text-sm text-slate-500">
                Loading active rentals...
              </p>
            ) : (
              <>
                <p className="text-4xl font-bold text-slate-950">
                  {activeCount}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Currently active rental orders
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
