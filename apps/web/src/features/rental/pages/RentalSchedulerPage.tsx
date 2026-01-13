import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import { LoadingState, NoCompanySelected } from '@/components/ui';
import { Card } from '@/components/ui/Card';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import CreateOrderModal from '../modals/CreateOrderModal';

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: 'bg-yellow-400',
  ACTIVE: 'bg-green-500',
};

const UNIT_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-100',
  RESERVED: 'bg-yellow-100',
  RENTED: 'bg-blue-100',
  MAINTENANCE: 'bg-red-100',
  CLEANING: 'bg-orange-100',
};

export default function RentalSchedulerPage() {
  const { currentCompany } = useCompany();

  // Date range state - default to current week
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    today.setDate(today.getDate() - today.getDay()); // Start of week
    return today;
  });

  const [daysToShow] = useState(14); // Show 2 weeks
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);

  const endDate = useMemo(() => {
    const end = new Date(startDate);
    end.setDate(end.getDate() + daysToShow);
    return end;
  }, [startDate, daysToShow]);

  const { data: timeline, isLoading } =
    trpc.rental.availability.timeline.useQuery(
      { startDate, endDate },
      { enabled: !!currentCompany?.id }
    );

  // Generate array of dates for header
  const dates = useMemo(() => {
    const result: Date[] = [];
    const current = new Date(startDate);
    for (let i = 0; i < daysToShow; i++) {
      result.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return result;
  }, [startDate, daysToShow]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setStartDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + (direction === 'next' ? 7 : -7));
      return next;
    });
  };

  const goToToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    today.setDate(today.getDate() - today.getDay());
    setStartDate(today);
  };

  if (isLoading) return <LoadingState />;
  if (!currentCompany)
    return (
      <NoCompanySelected message="Pilih perusahaan untuk melihat jadwal rental." />
    );

  // Helper to calculate booking position/width
  const getBookingStyle = (
    bookingStart: Date,
    bookingEnd: Date
  ): { left: string; width: string } | null => {
    const rangeStart = startDate.getTime();
    const rangeEnd = endDate.getTime();
    const bStart = new Date(bookingStart).getTime();
    const bEnd = new Date(bookingEnd).getTime();

    // Check if booking overlaps with visible range
    if (bEnd < rangeStart || bStart > rangeEnd) return null;

    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = daysToShow;

    const clampedStart = Math.max(bStart, rangeStart);
    const clampedEnd = Math.min(bEnd, rangeEnd);

    const leftDays = (clampedStart - rangeStart) / dayMs;
    const widthDays = (clampedEnd - clampedStart) / dayMs;

    return {
      left: `${(leftDays / totalDays) * 100}%`,
      width: `${Math.max((widthDays / totalDays) * 100, 2)}%`,
    };
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <>
      <CreateOrderModal
        isOpen={isCreateOrderOpen}
        onClose={() => setIsCreateOrderOpen(false)}
        onSuccess={() => setIsCreateOrderOpen(false)}
      />``

      <PageContainer>
        <PageHeader
          title="Rental Scheduler"
          description="Lihat ketersediaan unit dan jadwal rental"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateWeek('prev')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Hari Ini
              </button>
              <button
                onClick={() => navigateWeek('next')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          }
        />

        {/* Date range display */}
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          <CalendarDaysIcon className="w-4 h-4" />
          <span>
            {startDate.toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}{' '}
            -{' '}
            {endDate.toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>

        {/* Mobile scroll hint */}
        <p className="text-xs text-gray-400 mb-2 sm:hidden">
          ← Geser untuk melihat jadwal →
        </p>

        <Card className="overflow-hidden">
          {/* Horizontal scroll container for mobile */}
          <div className="overflow-x-auto">
            <div className="min-w-200">
              {/* Timeline Header */}
              <div className="flex border-b bg-gray-50">
                <div className="w-48 shrink-0 p-3 font-medium text-gray-700 border-r">
                  Item / Unit
                </div>
                <div className="flex-1 flex">
                  {dates.map((date, idx) => (
                    <div
                      key={idx}
                      className={`flex-1 text-center py-2 text-xs border-r last:border-r-0 ${
                        isToday(date)
                          ? 'bg-primary-100 font-bold text-primary-700'
                          : 'text-gray-600'
                      }`}
                    >
                      {formatDate(date)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline Body */}
              {timeline?.items.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <CalendarDaysIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Belum ada item rental.</p>
                  <Link
                    to="/rental/items"
                    className="text-primary-600 hover:underline"
                  >
                    Tambah item rental →
                  </Link>
                </div>
              ) : (
                <div className="divide-y">
                  {timeline?.items.map((item) => (
                    <div key={item.id}>
                      {/* Item Header */}
                      <div className="flex bg-gray-50/50">
                        <div className="w-48 shrink-0 p-2 font-medium text-gray-700 border-r text-sm">
                          {item.name}
                        </div>
                        <div className="flex-1 p-2 text-xs text-gray-500">
                          {item.units.length} unit
                        </div>
                      </div>

                      {/* Units */}
                      {item.units.map((unit) => (
                        <div
                          key={unit.id}
                          className="flex hover:bg-gray-50"
                        >
                          {/* Unit Label */}
                          <div
                            className={`w-48 shrink-0 p-2 pl-6 border-r text-sm flex items-center gap-2 ${UNIT_STATUS_COLORS[unit.status] || ''}`}
                          >
                            <span className="font-mono">
                              {unit.unitCode}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                unit.status === 'AVAILABLE'
                                  ? 'bg-green-200 text-green-800'
                                  : unit.status === 'RENTED'
                                    ? 'bg-blue-200 text-blue-800'
                                    : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {unit.status}
                            </span>
                            {unit.status === 'AVAILABLE' && (
                              <button
                                onClick={() =>
                                  setIsCreateOrderOpen(true)
                                }
                                className="ml-auto p-0.5 text-green-600 hover:bg-green-200 rounded transition-colors"
                                title="Buat order untuk unit ini"
                              >
                                <PlusCircleIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {/* Timeline Grid */}
                          <div className="flex-1 relative h-10">
                            {/* Grid lines */}
                            <div className="absolute inset-0 flex">
                              {dates.map((date, idx) => (
                                <div
                                  key={idx}
                                  className={`flex-1 border-r last:border-r-0 ${
                                    isToday(date)
                                      ? 'bg-primary-50/50'
                                      : ''
                                  }`}
                                />
                              ))}
                            </div>

                            {/* Booking blocks */}
                            {unit.bookings.map((booking) => {
                              const style = getBookingStyle(
                                booking.startDate,
                                booking.endDate
                              );
                              if (!style) return null;

                              return (
                                <Link
                                  key={booking.orderId}
                                  to={`/rental/orders/${booking.orderId}`}
                                  className={`absolute top-1 bottom-1 rounded-md ${STATUS_COLORS[booking.status] || 'bg-gray-400'} text-white text-xs flex items-center px-2 overflow-hidden hover:opacity-80 transition-opacity`}
                                  style={style}
                                  title={`${booking.orderNumber} - ${booking.partnerName}`}
                                >
                                  <span className="truncate">
                                    {booking.orderNumber}
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
          <span className="font-medium">Legend:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-400" />
            <span>Confirmed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>Active</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-200" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-200" />
            <span>Rented</span>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
