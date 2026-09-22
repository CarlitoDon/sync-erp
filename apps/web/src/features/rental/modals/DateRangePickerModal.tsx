import { useState, useMemo, useCallback } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  addCalendarDays,
  startOfLocalDay,
  isSameLocalDay,
} from '../utils/schedulerTimeline';

interface DateRangePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStartDate: Date;
  daysToShow: number;
  onApply: (newStartDate: Date, newDays: number) => void;
}

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function getMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startingDayIndex = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: Date[] = [];
  // Pad previous month days for alignment
  for (let i = startingDayIndex - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }
  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month, d));
  }
  // Pad next month days to complete the grid (up to 35 or 42)
  const remaining = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    days.push(new Date(year, month + 1, d));
  }
  return days;
}

function formatMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function DateRangePickerModal({
  isOpen,
  onClose,
  currentStartDate,
  daysToShow,
  onApply,
}: DateRangePickerModalProps) {
  const today = useMemo(() => startOfLocalDay(new Date()), []);

  // Selection state
  const [selectedStart, setSelectedStart] = useState<Date>(() =>
    startOfLocalDay(currentStartDate)
  );
  const [selectedDays, setSelectedDays] = useState<number>(daysToShow);

  // Calendar month view (shows 2 consecutive months)
  const [viewYear, setViewYear] = useState<number>(() =>
    currentStartDate.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState<number>(() =>
    currentStartDate.getMonth()
  );

  const month1Days = useMemo(
    () => getMonthDays(viewYear, viewMonth),
    [viewYear, viewMonth]
  );
  const month2Year = viewMonth === 11 ? viewYear + 1 : viewYear;
  const month2Month = viewMonth === 11 ? 0 : viewMonth + 1;
  const month2Days = useMemo(
    () => getMonthDays(month2Year, month2Month),
    [month2Year, month2Month]
  );

  const selectedEnd = useMemo(
    () => addCalendarDays(selectedStart, selectedDays - 1),
    [selectedStart, selectedDays]
  );

  const prevMonth = useCallback(() => {
    setViewMonth((prev) => {
      if (prev === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((prev) => {
      if (prev === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  const handleSelectDate = useCallback(
    (date: Date) => {
      const normalized = startOfLocalDay(date);
      setSelectedStart(normalized);
    },
    []
  );

  // Quick preset: Center today (2 days buffer before today)
  const setCenterToday = useCallback(() => {
    const start = addCalendarDays(today, -2);
    setSelectedStart(start);
    setSelectedDays(14);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }, [today]);

  // Quick preset: Start of current week (Monday)
  const setStartOfWeek = useCallback(() => {
    const dayOfWeek = today.getDay(); // 0 = Sunday
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = addCalendarDays(today, diffToMonday);
    setSelectedStart(monday);
    setSelectedDays(14);
    setViewYear(monday.getFullYear());
    setViewMonth(monday.getMonth());
  }, [today]);

  // Quick preset: Start of current month
  const setStartOfMonth = useCallback(() => {
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    setSelectedStart(firstOfMonth);
    setSelectedDays(28);
    setViewYear(firstOfMonth.getFullYear());
    setViewMonth(firstOfMonth.getMonth());
  }, [today]);

  const handleApply = () => {
    onApply(selectedStart, selectedDays);
    onClose();
  };

  if (!isOpen) return null;

  const renderMonthCalendar = (
    year: number,
    month: number,
    days: Date[]
  ) => {
    return (
      <div className="flex-1 min-w-[260px]">
        <h4 className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-slate-700">
          {formatMonthYear(year, month)}
        </h4>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400 mb-1">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="py-1">
              {wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
          {days.map((date) => {
            const isCurrentMonth = date.getMonth() === month;
            const isToday = isSameLocalDay(date, today);
            const isStart = isSameLocalDay(date, selectedStart);
            const isEnd = isSameLocalDay(date, selectedEnd);
            const isInRange =
              date >= selectedStart && date <= selectedEnd;

            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => handleSelectDate(date)}
                className={`relative h-8 w-full flex items-center justify-center transition-colors text-xs font-medium ${
                  !isCurrentMonth ? 'text-slate-300' : 'text-slate-700'
                } ${
                  isInRange
                    ? 'bg-primary-50 text-primary-900'
                    : 'hover:bg-slate-100'
                } ${
                  isStart
                    ? '!bg-primary-600 !text-white rounded-l-full font-bold shadow-xs'
                    : ''
                } ${
                  isEnd
                    ? '!bg-primary-600 !text-white rounded-r-full font-bold shadow-xs'
                    : ''
                } ${
                  isStart && isEnd ? 'rounded-full' : ''
                }`}
                title={formatDisplayDate(date)}
              >
                {isToday && !isStart && !isEnd && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary-600" />
                )}
                <span>{date.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="date-range-picker-title"
    >
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        />

        <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-2xl transition-all">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                <CalendarDaysIcon className="h-5 w-5" />
              </span>
              <div>
                <h3
                  id="date-range-picker-title"
                  className="text-base font-bold text-slate-900"
                >
                  Pilih Rentang Tanggal Timeline
                </h3>
                <p className="text-xs text-slate-500">
                  Tentukan tanggal awal dan jumlah hari yang ingin dipantau.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-2 pt-4">
            <span className="text-xs font-semibold text-slate-600 mr-1">
              Preset Cepat:
            </span>
            <button
              type="button"
              onClick={setCenterToday}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300"
            >
              Hari Ini (Tengah Kalender)
            </button>
            <button
              type="button"
              onClick={setStartOfWeek}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300"
            >
              Awal Pekan Ini (Senin)
            </button>
            <button
              type="button"
              onClick={setStartOfMonth}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300"
            >
              Awal Bulan Ini
            </button>
          </div>

          {/* Selected Range Display & Controls */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-200/80 bg-primary-50/50 p-3 text-xs">
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="h-4 w-4 text-primary-700" />
              <span className="font-semibold text-primary-950">
                {formatDisplayDate(selectedStart)} —{' '}
                {formatDisplayDate(selectedEnd)}
              </span>
              <span className="rounded-full bg-primary-100 px-2 py-0.5 font-bold text-primary-800">
                {selectedDays} hari
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="range-days-select" className="text-slate-600 font-medium">
                Rentang:
              </label>
              <select
                id="range-days-select"
                value={selectedDays}
                onChange={(e) => setSelectedDays(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 shadow-xs"
              >
                <option value={7}>7 hari (1 minggu)</option>
                <option value={14}>14 hari (2 minggu)</option>
                <option value={21}>21 hari (3 minggu)</option>
                <option value={28}>28 hari (4 minggu)</option>
                <option value={42}>42 hari (6 minggu)</option>
              </select>
            </div>
          </div>

          {/* Calendars navigation */}
          <div className="mt-4 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={prevMonth}
              className="flex items-center gap-1 rounded-lg border border-slate-200 p-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              title="Bulan sebelumnya"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              <span>Sebelumnya</span>
            </button>
            <span className="text-xs font-medium text-slate-500">
              Klik tanggal untuk menentukan titik mulai
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="flex items-center gap-1 rounded-lg border border-slate-200 p-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              title="Bulan berikutnya"
            >
              <span>Berikutnya</span>
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Two-Month Grid */}
          <div className="mt-3 flex flex-col gap-6 sm:flex-row border-t border-b border-slate-100 py-4">
            {renderMonthCalendar(viewYear, viewMonth, month1Days)}
            {renderMonthCalendar(month2Year, month2Month, month2Days)}
          </div>

          {/* Footer actions */}
          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-primary-600 px-5 py-2 text-xs font-semibold text-white hover:bg-primary-700 transition-colors shadow-xs"
            >
              Terapkan Jadwal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
