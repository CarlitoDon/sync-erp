import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { DashboardKPIs } from './DashboardKPIs';
import { trpc } from '@/lib/trpc';
import { formatDate } from '@/utils/format';
import { useCompany } from '@/contexts/CompanyContext';
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

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
    <div className="space-y-8">
      <DashboardKPIs />

      <section aria-labelledby="rental-operations-heading">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700">
              Daily workflow
            </p>
            <h2
              id="rental-operations-heading"
              className="mt-1 text-xl font-semibold tracking-tight text-slate-950"
            >
              Rental operations
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Returns, pickups, and active orders that need attention.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/rental/orders"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-primary-200 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 active:scale-[0.98]"
            >
              <ClipboardDocumentListIcon className="h-4 w-4" />
              Orders
            </Link>
            <Link
              to="/rental/scheduler"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              <CalendarDaysIcon className="h-4 w-4" />
              Scheduler
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="min-h-[18rem] lg:col-span-2">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Upcoming returns & pickups</CardTitle>
                <CardDescription>
                  Scheduled through {formatDate(dateRange.endDate)}
                </CardDescription>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary-100 bg-primary-50 text-primary-700">
                <CalendarDaysIcon className="h-5 w-5" />
              </span>
            </CardHeader>
            <CardContent>
              {isTimelineLoading ? (
                <div
                  className="animate-pulse space-y-3"
                  aria-label="Loading timeline"
                >
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                    >
                      <div className="h-4 w-40 rounded bg-slate-200" />
                      <div className="h-4 w-24 rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
              ) : upcomingBookings.length > 0 ? (
                <ul className="space-y-2">
                  {upcomingBookings.map((booking) => (
                    <li
                      key={`${booking.orderId}-${booking.startDate.toString()}-${booking.endDate.toString()}`}
                      className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary-700 shadow-sm ring-1 ring-slate-200/70">
                          <ClockIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {booking.partnerName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {booking.orderNumber}
                          </p>
                        </div>
                      </div>
                      <span className="w-fit rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-mono font-semibold text-slate-600 tabular-nums">
                        {formatDate(new Date(booking.endDate))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-7 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700">
                    <CheckCircleIcon className="h-6 w-6" />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-slate-900">
                    The next seven days are clear
                  </p>
                  <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                    No returns or pickups are currently scheduled in
                    this window.
                  </p>
                  <Link
                    to="/rental/scheduler"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 transition-colors hover:text-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    Open rental calendar
                    <ArrowUpRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex min-h-[18rem] flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm shadow-slate-900/5 transition-all">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 ring-1 ring-blue-200/60">
                    In progress
                  </span>
                  <h3 className="mt-1.5 text-lg font-bold text-slate-900">
                    Active rentals
                  </h3>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-700 shadow-2xs">
                  <ClipboardDocumentListIcon className="h-5 w-5" />
                </span>
              </div>

              {isOrdersLoading ? (
                <div
                  className="mt-8 animate-pulse"
                  aria-label="Loading active rentals"
                >
                  <div className="h-12 w-24 rounded bg-slate-200" />
                  <div className="mt-3 h-4 w-40 rounded bg-slate-100" />
                </div>
              ) : (
                <div className="mt-6" aria-live="polite">
                  <p className="font-mono text-5xl font-bold tracking-tight text-slate-950 tabular-nums">
                    {activeCount}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Pesanan sewa yang sedang aktif berjalan
                  </p>
                </div>
              )}
            </div>

            <Link
              to="/rental/orders"
              className="mt-8 inline-flex items-center justify-between rounded-xl bg-blue-600 px-4 py-3 text-xs font-semibold text-white shadow-sm shadow-blue-600/20 transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <span>Lihat Semua Pesanan Aktif</span>
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
