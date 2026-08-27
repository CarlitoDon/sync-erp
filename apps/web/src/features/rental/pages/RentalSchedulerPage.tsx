import { useMemo, useState } from 'react';
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import {
  Button,
  LoadingState,
  NoCompanySelected,
} from '@/components/ui';
import { Card, CardContent } from '@/components/ui/Card';
import CreateOrderModal from '../modals/CreateOrderModal';
import { RentalAvailabilityTimeline } from '../components/RentalAvailabilityTimeline';
import {
  addCalendarDays,
  endOfLocalDay,
  SCHEDULER_WINDOW_OPTIONS,
  startOfLocalDay,
  type SchedulerWindowDays,
} from '../utils/schedulerTimeline';

function formatRangeDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function RentalSchedulerPage() {
  const { currentCompany } = useCompany();
  const [startDate, setStartDate] = useState(() =>
    startOfLocalDay(new Date())
  );
  const [daysToShow, setDaysToShow] =
    useState<SchedulerWindowDays>(14);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);

  const visibleEndDate = useMemo(
    () => addCalendarDays(startDate, daysToShow - 1),
    [daysToShow, startDate]
  );
  const queryEndDate = useMemo(
    () => endOfLocalDay(visibleEndDate),
    [visibleEndDate]
  );
  const {
    data: timeline,
    isLoading,
    isError,
    refetch,
  } = trpc.rental.availability.timeline.useQuery(
    { startDate, endDate: queryEndDate },
    { enabled: !!currentCompany?.id }
  );

  const navigateWindow = (direction: 'previous' | 'next') => {
    setStartDate((currentStart) =>
      addCalendarDays(
        currentStart,
        direction === 'next' ? daysToShow : -daysToShow
      )
    );
  };

  const goToToday = () => setStartDate(startOfLocalDay(new Date()));

  if (!currentCompany) {
    return (
      <NoCompanySelected message="Pilih perusahaan untuk melihat jadwal ketersediaan rental." />
    );
  }

  if (isLoading) {
    return <LoadingState className="min-h-96" />;
  }

  if (isError || !timeline) {
    return (
      <PageContainer>
        <PageHeader
          title="Rental Scheduler"
          description="Lihat ketersediaan unit dan jadwal rental"
        />
        <Card className="mt-6">
          <CardContent className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
              <CalendarDaysIcon
                className="h-6 w-6"
                aria-hidden="true"
              />
            </span>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              Jadwal tidak dapat dimuat
            </h2>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
              Periksa koneksi Anda, lalu coba muat ulang timeline
              ketersediaan.
            </p>
            <Button className="mt-5" onClick={() => void refetch()}>
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <>
      <CreateOrderModal
        isOpen={isCreateOrderOpen}
        onClose={() => setIsCreateOrderOpen(false)}
        onSuccess={() => setIsCreateOrderOpen(false)}
      />

      <PageContainer>
        <PageHeader
          title="Rental Scheduler"
          description="Pantau ketersediaan unit dan booking rental dalam satu timeline."
          actions={
            <Button onClick={() => setIsCreateOrderOpen(true)}>
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
              Buat order
            </Button>
          }
        />

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CalendarDaysIcon
                className="h-4 w-4 text-primary-700"
                aria-hidden="true"
              />
              <span>
                {formatRangeDate(startDate)} –{' '}
                {formatRangeDate(visibleEndDate)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Gunakan scroll atau tarik area kosong timeline untuk
              melihat tanggal dan unit lainnya.
            </p>
          </div>

          <div
            className="flex flex-wrap items-center gap-2"
            aria-label="Kontrol timeline rental"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWindow('previous')}
              aria-label="Rentang sebelumnya"
              title="Rentang sebelumnya"
            >
              <ChevronLeftIcon
                className="h-4 w-4"
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Sebelumnya</span>
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Hari ini
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWindow('next')}
              aria-label="Rentang berikutnya"
              title="Rentang berikutnya"
            >
              <span className="hidden sm:inline">Berikutnya</span>
              <ChevronRightIcon
                className="h-4 w-4"
                aria-hidden="true"
              />
            </Button>
            <label
              className="sr-only"
              htmlFor="scheduler-visible-range"
            >
              Rentang hari yang ditampilkan
            </label>
            <select
              id="scheduler-visible-range"
              value={daysToShow}
              onChange={(event) =>
                setDaysToShow(
                  Number(event.target.value) as SchedulerWindowDays
                )
              }
              className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            >
              {SCHEDULER_WINDOW_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days} hari
                </option>
              ))}
            </select>
          </div>
        </div>

        <Card className="mt-4 overflow-hidden">
          <RentalAvailabilityTimeline
            timeline={timeline}
            startDate={startDate}
            daysToShow={daysToShow}
            onCreateOrder={() => setIsCreateOrderOpen(true)}
          />
        </Card>

        <div
          className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600"
          aria-label="Legenda status timeline"
        >
          <span className="font-semibold text-slate-700">
            Legenda:
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm bg-amber-500"
              aria-hidden="true"
            />
            Booking dikonfirmasi
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm bg-emerald-600"
              aria-hidden="true"
            />
            Booking aktif
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm bg-primary-100 ring-1 ring-primary-200"
              aria-hidden="true"
            />
            Hari ini
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm bg-slate-100 ring-1 ring-slate-200"
              aria-hidden="true"
            />
            Akhir pekan
          </span>
        </div>
      </PageContainer>
    </>
  );
}
