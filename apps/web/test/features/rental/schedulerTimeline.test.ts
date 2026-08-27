import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  endOfLocalDay,
  getInclusiveBookingGeometry,
  getVisibleDates,
  startOfLocalDay,
} from '@/features/rental/utils/schedulerTimeline';

describe('schedulerTimeline', () => {
  const visibleStart = new Date(2026, 7, 24, 9, 30);

  it('normalizes query boundaries to the local calendar day', () => {
    expect(startOfLocalDay(visibleStart)).toEqual(
      new Date(2026, 7, 24)
    );
    expect(endOfLocalDay(visibleStart)).toEqual(
      new Date(2026, 7, 24, 23, 59, 59, 999)
    );
  });

  it('creates the exact number of visible calendar-day columns', () => {
    const dates = getVisibleDates(visibleStart, 14);

    expect(dates).toHaveLength(14);
    expect(dates[0]).toEqual(new Date(2026, 7, 24));
    expect(dates[13]).toEqual(new Date(2026, 8, 6));
  });

  it('gives a same-day booking one full visible day column', () => {
    expect(
      getInclusiveBookingGeometry(
        new Date(2026, 7, 26, 8),
        new Date(2026, 7, 26, 18),
        visibleStart,
        14
      )
    ).toEqual({ startColumn: 3, span: 1 });
  });

  it('clips an inclusive booking to the displayed range', () => {
    expect(
      getInclusiveBookingGeometry(
        new Date(2026, 7, 20),
        new Date(2026, 8, 10),
        visibleStart,
        14
      )
    ).toEqual({ startColumn: 1, span: 14 });
  });

  it('excludes bookings that do not intersect the visible window', () => {
    expect(
      getInclusiveBookingGeometry(
        new Date(2026, 7, 1),
        new Date(2026, 7, 23),
        visibleStart,
        14
      )
    ).toBeNull();
  });

  it('moves between windows by whole calendar days', () => {
    expect(addCalendarDays(visibleStart, 28)).toEqual(
      new Date(2026, 8, 21)
    );
  });
});
