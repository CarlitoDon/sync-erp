import { useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  CalendarDaysIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import type { RouterOutputs } from '@/lib/trpc';
import {
  getInclusiveBookingGeometry,
  getVisibleDates,
  isSameLocalDay,
  isWeekend,
} from '../utils/schedulerTimeline';

const LABEL_COLUMN_WIDTH = 224;
const DAY_COLUMN_WIDTH = 96;

const BOOKING_STYLES: Record<string, string> = {
  CONFIRMED:
    'bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-500',
  ACTIVE:
    'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500',
};

const UNIT_STATUS_STYLES: Record<string, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  RESERVED: 'bg-amber-50 text-amber-700 ring-amber-200',
  RENTED: 'bg-blue-50 text-blue-700 ring-blue-200',
  MAINTENANCE: 'bg-rose-50 text-rose-700 ring-rose-200',
  CLEANING: 'bg-orange-50 text-orange-700 ring-orange-200',
};

export type RentalAvailabilityTimelineData =
  RouterOutputs['rental']['availability']['timeline'];

interface RentalAvailabilityTimelineProps {
  timeline: RentalAvailabilityTimelineData;
  startDate: Date;
  daysToShow: number;
  onCreateOrder: () => void;
}

interface DragState {
  pointerId: number;
  originX: number;
  originY: number;
  scrollLeft: number;
  scrollTop: number;
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
  });
}

function formatBookingDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function bookingLabel(
  booking: RentalAvailabilityTimelineData['items'][number]['units'][number]['bookings'][number]
): string {
  return `${booking.orderNumber}, ${booking.partnerName}, ${formatBookingDate(
    booking.startDate
  )} sampai ${formatBookingDate(booking.endDate)}, status ${booking.status}. Buka order.`;
}

export function RentalAvailabilityTimeline({
  timeline,
  startDate,
  daysToShow,
  onCreateOrder,
}: RentalAvailabilityTimelineProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dates = useMemo(
    () => getVisibleDates(startDate, daysToShow),
    [daysToShow, startDate]
  );
  const today = useMemo(() => new Date(), []);
  const hasBookings = timeline.items.some((item) =>
    item.units.some((unit) => unit.bookings.length > 0)
  );
  const gridColumns = `${LABEL_COLUMN_WIDTH}px repeat(${daysToShow}, ${DAY_COLUMN_WIDTH}px)`;
  const gridWidth =
    LABEL_COLUMN_WIDTH + daysToShow * DAY_COLUMN_WIDTH;

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
    setIsDragging(false);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return;

    const target = event.target as HTMLElement;
    if (
      target.closest(
        'a, button, input, select, textarea, [data-timeline-interactive]'
      )
    ) {
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    const viewport = viewportRef.current;
    if (
      !dragState ||
      !viewport ||
      dragState.pointerId !== event.pointerId
    )
      return;

    viewport.scrollLeft =
      dragState.scrollLeft - (event.clientX - dragState.originX);
    viewport.scrollTop =
      dragState.scrollTop - (event.clientY - dragState.originY);
    event.preventDefault();
  };

  if (timeline.items.length === 0) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <CalendarDaysIcon className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-base font-semibold text-slate-900">
          Belum ada item rental
        </h2>
        <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
          Tambahkan item dan unit rental untuk mulai melihat
          ketersediaannya di kalender.
        </p>
        <Link
          to="/rental/items"
          className="mt-4 text-sm font-semibold text-primary-700 hover:text-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          Tambah item rental
        </Link>
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className={`h-[min(68vh,42rem)] min-h-96 overflow-auto overscroll-contain border-y border-slate-200 bg-white ${
        isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
      }`}
      tabIndex={0}
      aria-label="Timeline ketersediaan rental. Gulir dua arah untuk melihat tanggal dan unit lainnya."
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div style={{ width: gridWidth }}>
        <div
          className="sticky top-0 z-30 grid border-b border-slate-200 bg-slate-50 shadow-[0_1px_0_rgba(15,23,42,0.05)]"
          style={{ gridTemplateColumns: gridColumns }}
        >
          <div className="sticky left-0 z-40 flex min-h-14 items-center border-r border-slate-200 bg-slate-50 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Item / unit
          </div>
          {dates.map((date) => {
            const isCurrentDay = isSameLocalDay(date, today);
            const isWeekendDay = isWeekend(date);

            return (
              <div
                key={date.toISOString()}
                className={`flex min-h-14 items-center justify-center border-r border-slate-200 px-1 text-center text-xs font-semibold ${
                  isCurrentDay
                    ? 'bg-primary-50 text-primary-800'
                    : isWeekendDay
                      ? 'bg-slate-100/80 text-slate-600'
                      : 'text-slate-600'
                }`}
              >
                <span>{formatDayHeader(date)}</span>
              </div>
            );
          })}
        </div>

        {!hasBookings && (
          <div
            className="border-b border-primary-100 bg-primary-50/70 px-4 py-2 text-sm text-primary-800"
            role="status"
          >
            Belum ada booking pada rentang ini. Unit tetap dapat
            dipantau dan order baru dapat dibuat dari unit yang
            tersedia.
          </div>
        )}

        {timeline.items.map((item) => (
          <section
            key={item.id}
            aria-label={`Item rental ${item.name}`}
          >
            <div
              className="grid border-b border-slate-200 bg-slate-50/70"
              style={{ gridTemplateColumns: gridColumns }}
            >
              <div className="sticky left-0 z-20 flex min-h-10 items-center border-r border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900">
                <span className="truncate">{item.name}</span>
              </div>
              <div
                className="flex min-h-10 items-center px-4 text-xs font-medium text-slate-500"
                style={{ gridColumn: '2 / -1' }}
              >
                {item.units.length} unit
              </div>
            </div>

            {item.units.map((unit) => (
              <div
                key={unit.id}
                className="grid border-b border-slate-100 bg-white transition-colors duration-[var(--duration-fast)] hover:bg-slate-50/70"
                style={{ gridTemplateColumns: gridColumns }}
              >
                <div className="sticky left-0 z-20 flex min-h-14 items-center gap-2 border-r border-slate-200 bg-white px-4 shadow-[1px_0_0_rgba(15,23,42,0.04)]">
                  <span className="min-w-0 truncate font-mono text-sm font-semibold text-slate-800">
                    {unit.unitCode}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                      UNIT_STATUS_STYLES[unit.status] ??
                      'bg-slate-100 text-slate-700 ring-slate-200'
                    }`}
                  >
                    {unit.status}
                  </span>
                  {unit.status === 'AVAILABLE' && (
                    <button
                      type="button"
                      onClick={onCreateOrder}
                      className="ml-auto rounded p-1 text-emerald-700 transition-colors duration-[var(--duration-fast)] hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      aria-label={`Buat order untuk unit ${unit.unitCode}`}
                      title="Buat order untuk unit ini"
                    >
                      <PlusCircleIcon
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    </button>
                  )}
                </div>
                <div
                  className="relative grid min-h-14"
                  style={{
                    gridColumn: '2 / -1',
                    gridTemplateColumns: `repeat(${daysToShow}, ${DAY_COLUMN_WIDTH}px)`,
                  }}
                >
                  {dates.map((date, index) => (
                    <div
                      key={date.toISOString()}
                      aria-hidden="true"
                      className={`h-full border-r border-slate-100 ${
                        isSameLocalDay(date, today)
                          ? 'bg-primary-50/70'
                          : isWeekend(date)
                            ? 'bg-slate-50/80'
                            : ''
                      }`}
                      style={{ gridColumn: index + 1, gridRow: 1 }}
                    />
                  ))}
                  {unit.bookings.map((booking) => {
                    const geometry = getInclusiveBookingGeometry(
                      booking.startDate,
                      booking.endDate,
                      startDate,
                      daysToShow
                    );
                    if (!geometry) return null;

                    return (
                      <Link
                        key={booking.orderId}
                        to={`/rental/orders/${booking.orderId}`}
                        aria-label={bookingLabel(booking)}
                        title={bookingLabel(booking)}
                        className={`z-10 mx-1 flex h-8 min-w-0 self-center rounded-md px-2 text-xs font-semibold text-white shadow-sm transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                          BOOKING_STYLES[booking.status] ??
                          'bg-slate-600 hover:bg-slate-700 focus-visible:ring-slate-500'
                        }`}
                        style={{
                          gridColumn: `${geometry.startColumn} / span ${geometry.span}`,
                          gridRow: 1,
                        }}
                      >
                        <span className="truncate leading-8">
                          {booking.orderNumber}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
