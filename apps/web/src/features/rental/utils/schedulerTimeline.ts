export const SCHEDULER_WINDOW_OPTIONS = [14, 28, 42] as const;

export type SchedulerWindowDays =
  (typeof SCHEDULER_WINDOW_OPTIONS)[number];

export interface BookingGeometry {
  startColumn: number;
  span: number;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function startOfLocalDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfLocalDay(date: Date): Date {
  const result = startOfLocalDay(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function addCalendarDays(date: Date, days: number): Date {
  const result = startOfLocalDay(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getVisibleDates(
  startDate: Date,
  daysToShow: number
): Date[] {
  return Array.from({ length: daysToShow }, (_, index) =>
    addCalendarDays(startDate, index)
  );
}

export function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function calendarDayNumber(date: Date): number {
  return (
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
    DAY_IN_MS
  );
}

/**
 * Converts a booking to one-based CSS grid coordinates for the visible window.
 * Both ends are calendar-day inclusive, so a same-day booking spans one column.
 */
export function getInclusiveBookingGeometry(
  bookingStart: Date,
  bookingEnd: Date,
  visibleStart: Date,
  daysToShow: number
): BookingGeometry | null {
  const rangeStart = startOfLocalDay(visibleStart);
  const rangeEnd = addCalendarDays(rangeStart, daysToShow - 1);
  const start = startOfLocalDay(bookingStart);
  const end = startOfLocalDay(bookingEnd);

  if (
    daysToShow < 1 ||
    calendarDayNumber(end) < calendarDayNumber(start)
  ) {
    return null;
  }

  if (
    calendarDayNumber(end) < calendarDayNumber(rangeStart) ||
    calendarDayNumber(start) > calendarDayNumber(rangeEnd)
  ) {
    return null;
  }

  const clampedStart =
    calendarDayNumber(start) < calendarDayNumber(rangeStart)
      ? rangeStart
      : start;
  const clampedEnd =
    calendarDayNumber(end) > calendarDayNumber(rangeEnd)
      ? rangeEnd
      : end;

  return {
    startColumn:
      calendarDayNumber(clampedStart) -
      calendarDayNumber(rangeStart) +
      1,
    span:
      calendarDayNumber(clampedEnd) -
      calendarDayNumber(clampedStart) +
      1,
  };
}
