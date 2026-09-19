import { useState, useMemo } from 'react';
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
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  TruckIcon,
  ArrowUturnLeftIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  ChatBubbleLeftRightIcon,
  MapPinIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import type {
  RentalAdminTaskItem,
  RentalAdminTaskCategory,
  RentalAdminSuggestedAction,
} from '@sync-erp/shared';
import FormModal from '@/components/ui/FormModal';
import ConfirmOrderModal from '../modals/ConfirmOrderModal';
import UnitAssignmentModal from '../modals/UnitAssignmentModal';
import VerifyPaymentModal from '../modals/VerifyPaymentModal';
import ReturnModal from '../modals/ReturnModal';

type UrgencyFilter = 'ALL' | 'OVERDUE' | 'TODAY' | 'UPCOMING';

function buildWhatsAppUrl(
  phone: string | null | undefined,
  task: RentalAdminTaskItem
): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  let cleaned = trimmed.replace(/[^0-9]/g, '');
  if (cleaned.length < 8) return null;

  if (trimmed.startsWith('+')) {
    // International number with explicit '+' - use cleaned digits
  } else if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  if (cleaned.length < 9) return null;

  let text = '';
  switch (task.taskType) {
    case 'CONFIRM_AND_DP':
      text = `Halo kak ${task.customerName}, kami dari tim Santi Living ingin mengonfirmasi pesanan rental ${task.orderNumber} (${task.itemsSummary}). Apakah pesanan dan jadwalnya sudah sesuai kak? Terima kasih.`;
      break;
    case 'VERIFY_PAYMENT':
      text = `Halo kak ${task.customerName}, terima kasih sudah konfirmasi pembayaran untuk pesanan ${task.orderNumber}. Kami sedang memverifikasi mutasi rekening Anda ya kak.`;
      break;
    case 'DELIVERY_DISPATCH':
      text = `Halo kak ${task.customerName}, armada Santi Living siap mengirim pesanan rental ${task.orderNumber} (${task.itemsSummary}) ke alamat: ${task.deliveryAddress || 'lokasi Anda'}. Mohon pastikan ada penerima di lokasi ya kak.`;
      break;
    case 'PELUNASAN_PAYMENT':
      text = `Halo kak ${task.customerName}, menginfokan untuk pesanan rental ${task.orderNumber}, sisa pelunasan sebesar ${formatCurrency(task.remainingAmount)} dapat ditransfer atau diserahkan saat pengantaran ya kak. Terima kasih.`;
      break;
    case 'PICKUP_RETURN':
      text = `Halo kak ${task.customerName}, masa sewa untuk ${task.itemsSummary} (Order ${task.orderNumber}) sudah berakhir atau mendekati selesai. Apakah bermaksud memperpanjang sewa atau kami jadwalkan penjemputan unit hari ini?`;
      break;
    case 'SETTLE_RETURN':
      text = `Halo kak ${task.customerName}, unit untuk pesanan ${task.orderNumber} sudah kami terima. Kami sedang memproses pengecekan kondisi dan penyelesaian retur deposit Anda ya kak.`;
      break;
    default:
      text = `Halo kak ${task.customerName}, salam dari tim Santi Living mengenai pesanan rental ${task.orderNumber}.`;
      break;
  }

  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}

export default function RentalTasksPage() {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  // Filters state
  const [selectedCategory, setSelectedCategory] =
    useState<RentalAdminTaskCategory>('ALL');
  const [selectedUrgency, setSelectedUrgency] =
    useState<UrgencyFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    null
  );
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isReleaseOpen, setIsReleaseOpen] = useState(false);
  const [isVerifyPaymentOpen, setIsVerifyPaymentOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);

  // Queries
  const { data, isLoading, refetch } = trpc.rental.tasks.getQueue.useQuery(
    {
      category: selectedCategory === 'ALL' ? undefined : selectedCategory,
      urgency: selectedUrgency === 'ALL' ? undefined : selectedUrgency,
    },
    { enabled: !!currentCompany?.id }
  );

  // Fetch full order when an order action modal is opened
  const { data: selectedOrderData, isLoading: isLoadingSelectedOrder } =
    trpc.rental.orders.getById.useQuery(
      { id: (selectedOrderId as string) || '' },
      {
        enabled:
          Boolean(selectedOrderId) &&
          (isReleaseOpen || isVerifyPaymentOpen || isReturnOpen),
      }
    );

  const summary = data?.summary;
  const tasks = useMemo(() => {
    const list = data?.tasks ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (t) =>
        t.customerName.toLowerCase().includes(q) ||
        t.orderNumber.toLowerCase().includes(q) ||
        t.itemsSummary.toLowerCase().includes(q) ||
        (t.deliveryAddress && t.deliveryAddress.toLowerCase().includes(q))
    );
  }, [data?.tasks, searchQuery]);

  const handleActionSuccess = () => {
    setIsConfirmOpen(false);
    setIsReleaseOpen(false);
    setIsVerifyPaymentOpen(false);
    setIsReturnOpen(false);
    setSelectedOrderId(null);
    utils.rental.tasks.getQueue.invalidate();
    utils.rental.tasks.getSummary.invalidate();
    utils.rental.orders.list.invalidate();
    refetch();
  };

  const handleOpenActionModal = (
    orderId: string,
    action: RentalAdminSuggestedAction
  ) => {
    setSelectedOrderId(orderId);
    if (action === 'CONFIRM') {
      setIsConfirmOpen(true);
    } else if (action === 'VERIFY_PAYMENT') {
      setIsVerifyPaymentOpen(true);
    } else if (action === 'RELEASE') {
      setIsReleaseOpen(true);
    } else if (action === 'PROCESS_RETURN') {
      setIsReturnOpen(true);
    }
  };

  if (isLoading) return <LoadingState />;
  if (!currentCompany) {
    return (
      <NoCompanySelected message="Pilih perusahaan untuk melihat tugas admin rental." />
    );
  }

  const categoryTabs: Array<{
    id: RentalAdminTaskCategory;
    label: string;
    count: number;
  }> = [
    {
      id: 'ALL',
      label: 'Semua Tugas',
      count: summary?.totalPendingTasks ?? 0,
    },
    {
      id: 'CONFIRMATION',
      label: 'Perlu Konfirmasi',
      count: summary?.byCategory.confirmationCount ?? 0,
    },
    {
      id: 'DELIVERY',
      label: 'Kirim / Serah Terima',
      count: summary?.byCategory.deliveryCount ?? 0,
    },
    {
      id: 'PELUNASAN',
      label: 'Tagihan Pelunasan',
      count: summary?.byCategory.pelunasanCount ?? 0,
    },
    {
      id: 'PICKUP',
      label: 'Jadwal Jemput',
      count: summary?.byCategory.pickupCount ?? 0,
    },
    {
      id: 'RETURN',
      label: 'Retur & Deposit',
      count: summary?.byCategory.returnSettlementCount ?? 0,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Tugas Admin Rental"
        description="Antrian kerja operasional harian admin: konfirmasi DP, jadwal kirim serah terima, penagihan pelunasan, hingga penjemputan unit"
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/rental/orders"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
            >
              Semua Order Rental
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </Link>
          </div>
        }
      />

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {/* Total Pending */}
        <div
          onClick={() => {
            setSelectedCategory('ALL');
            setSelectedUrgency('ALL');
          }}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            selectedCategory === 'ALL' && selectedUrgency === 'ALL'
              ? 'bg-blue-50 border-blue-300 shadow-sm'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Total Tugas
            </span>
            <ClipboardDocumentListIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {summary?.totalPendingTasks ?? 0}
          </div>
          <p className="text-xs text-gray-500 mt-1">Seluruh siklus aktif</p>
        </div>

        {/* Terlambat (Overdue) */}
        <div
          onClick={() => setSelectedUrgency('OVERDUE')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            selectedUrgency === 'OVERDUE'
              ? 'bg-red-50 border-red-300 shadow-sm'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between text-red-600 mb-1">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Terlambat
            </span>
            <ExclamationCircleIcon className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-600">
            {summary?.overdueCount ?? 0}
          </div>
          <p className="text-xs text-red-500 mt-1">Urgensi prioritas utama</p>
        </div>

        {/* Perlu Konfirmasi */}
        <div
          onClick={() => {
            setSelectedCategory('CONFIRMATION');
            setSelectedUrgency('ALL');
          }}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            selectedCategory === 'CONFIRMATION'
              ? 'bg-amber-50 border-amber-300 shadow-sm'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Konfirmasi & DP
            </span>
            <CheckCircleIcon className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {summary?.byCategory.confirmationCount ?? 0}
          </div>
          <p className="text-xs text-amber-700 mt-1">Verifikasi & alokasi unit</p>
        </div>

        {/* Kirim / Dispatch */}
        <div
          onClick={() => {
            setSelectedCategory('DELIVERY');
            setSelectedUrgency('ALL');
          }}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            selectedCategory === 'DELIVERY'
              ? 'bg-emerald-50 border-emerald-300 shadow-sm'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Kirim / Antar
            </span>
            <TruckIcon className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {summary?.byCategory.deliveryCount ?? 0}
          </div>
          <p className="text-xs text-emerald-700 mt-1">Serah terima ke customer</p>
        </div>

        {/* Pelunasan */}
        <div
          onClick={() => {
            setSelectedCategory('PELUNASAN');
            setSelectedUrgency('ALL');
          }}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            selectedCategory === 'PELUNASAN'
              ? 'bg-purple-50 border-purple-300 shadow-sm'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between text-purple-600 mb-1">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Belum Lunas
            </span>
            <CurrencyDollarIcon className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {summary?.byCategory.pelunasanCount ?? 0}
          </div>
          <p className="text-xs text-purple-700 mt-1">Sisa tagihan sewa</p>
        </div>

        {/* Jadwal Jemput */}
        <div
          onClick={() => {
            setSelectedCategory('PICKUP');
            setSelectedUrgency('ALL');
          }}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            selectedCategory === 'PICKUP'
              ? 'bg-indigo-50 border-indigo-300 shadow-sm'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between text-indigo-600 mb-1">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Jemput Unit
            </span>
            <ArrowUturnLeftIcon className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">
            {summary?.byCategory.pickupCount ?? 0}
          </div>
          <p className="text-xs text-indigo-700 mt-1">Selesai sewa & retur</p>
        </div>
      </div>

      {/* Category Tabs & Urgency Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 border-b border-gray-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {categoryTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                selectedCategory === tab.id
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  selectedCategory === tab.id
                    ? 'bg-primary-700 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Urgency Pill Controls */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg">
          {(
            [
              { id: 'ALL', label: 'Semua' },
              { id: 'OVERDUE', label: '🚨 Terlambat' },
              { id: 'TODAY', label: '⚡ Hari Ini' },
              { id: 'UPCOMING', label: '📅 Akan Datang' },
            ] as const
          ).map((pill) => (
            <button
              key={pill.id}
              onClick={() => setSelectedUrgency(pill.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                selectedUrgency === pill.id
                  ? 'bg-white text-gray-900 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari customer, nomor order, alamat..."
            className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-xs text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
        <div className="text-xs text-gray-500">
          Menampilkan <span className="font-semibold text-gray-800">{tasks.length}</span> tugas aktif
        </div>
      </div>

      {/* Task Cards List */}
      {tasks.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
            <CheckCircleIcon className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            Bagus Sekali! Semua Tugas Sudah Selesai
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
            Tidak ada order rental yang memerlukan tindakan admin untuk kategori ini.
            Semua konfirmasi, pengiriman, dan penjemputan sudah up-to-date.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                setSelectedCategory('ALL');
                setSelectedUrgency('ALL');
                setSearchQuery('');
              }}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Lihat Semua Tugas
            </button>
            <Link
              to="/rental/orders"
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Buka Daftar Order
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const waLink = buildWhatsAppUrl(task.customerPhone, task);

            // Urgency styling
            let urgencyBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
            let urgencyLabel = `${task.daysDiff} HARI LAGI`;
            let urgencyIcon = <CalendarDaysIcon className="w-3.5 h-3.5" />;

            if (task.urgency === 'OVERDUE') {
              urgencyBadgeClass = 'bg-red-100 text-red-800 border-red-200 animate-pulse';
              urgencyLabel = `TERLAMBAT (${Math.abs(task.daysDiff)} HARI)`;
              urgencyIcon = <ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-600" />;
            } else if (task.urgency === 'TODAY') {
              urgencyBadgeClass = 'bg-amber-100 text-amber-800 border-amber-200 font-bold';
              urgencyLabel = 'HARI INI';
              urgencyIcon = <ClockIcon className="w-3.5 h-3.5 text-amber-600" />;
            } else if (task.daysDiff === 1) {
              urgencyBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
              urgencyLabel = 'BESOK';
            }

            // Category badge styling
            let categoryLabel = 'Lainnya';
            let categoryBadgeClass = 'bg-gray-100 text-gray-700';
            if (task.category === 'CONFIRMATION') {
              categoryLabel = 'Konfirmasi & DP';
              categoryBadgeClass = 'bg-amber-100 text-amber-800';
            } else if (task.category === 'DELIVERY') {
              categoryLabel = 'Pengiriman / Serah Terima';
              categoryBadgeClass = 'bg-emerald-100 text-emerald-800';
            } else if (task.category === 'PELUNASAN') {
              categoryLabel = 'Tagihan Pelunasan';
              categoryBadgeClass = 'bg-purple-100 text-purple-800';
            } else if (task.category === 'PICKUP') {
              categoryLabel = 'Jadwal Jemput Unit';
              categoryBadgeClass = 'bg-indigo-100 text-indigo-800';
            } else if (task.category === 'RETURN') {
              categoryLabel = 'Retur & Deposit';
              categoryBadgeClass = 'bg-teal-100 text-teal-800';
            }

            return (
              <Card
                key={task.id}
                className={`p-5 transition-all border ${
                  task.urgency === 'OVERDUE'
                    ? 'border-red-300 bg-red-50/30'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Task & Order Details */}
                  <div className="flex-1 space-y-2">
                    {/* Top row: Order Number, Urgency, Category */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/rental/orders/${task.orderId}`}
                        className="text-sm font-bold text-primary-600 hover:text-primary-800 hover:underline flex items-center gap-1"
                      >
                        {task.orderNumber}
                        <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                      </Link>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${urgencyBadgeClass}`}
                      >
                        {urgencyIcon}
                        {urgencyLabel}
                      </span>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${categoryBadgeClass}`}
                      >
                        {categoryLabel}
                      </span>
                    </div>

                    {/* Task Title */}
                    <h4 className="text-base font-bold text-gray-900 leading-snug">
                      {task.title}
                    </h4>

                    {/* Task Description */}
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {task.description}
                    </p>

                    {/* Customer & Address details */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs text-gray-700">
                      {/* Customer Name & WhatsApp */}
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {task.customerName}
                        </span>
                        {task.customerPhone && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-500 font-mono">
                              {task.customerPhone}
                            </span>
                            {waLink && (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-emerald-100 text-emerald-800 rounded-md hover:bg-emerald-200 transition-colors"
                                title="Kirim Pesan WhatsApp Langsung"
                              >
                                <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 text-emerald-700" />
                                Chat WA
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Delivery Address */}
                      {task.deliveryAddress && (
                        <div className="flex items-center gap-1 text-gray-500 max-w-sm truncate" title={task.deliveryAddress}>
                          <MapPinIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{task.deliveryAddress}</span>
                        </div>
                      )}

                      {/* Scheduled Date */}
                      <div className="flex items-center gap-1 text-gray-500">
                        <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>{formatDate(task.scheduledDate)}</span>
                      </div>
                    </div>

                    {/* Payment Balances Summary Bar */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
                      <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-gray-700">
                        Total Sewa: <strong className="text-gray-900">{formatCurrency(task.totalAmount)}</strong>
                      </span>
                      <span className="px-2.5 py-1 bg-emerald-50 rounded-lg text-emerald-800 border border-emerald-100">
                        DP Masuk: <strong>{formatCurrency(task.depositAmount)}</strong>
                      </span>
                      {task.remainingAmount > 0 ? (
                        <span className="px-2.5 py-1 bg-amber-50 rounded-lg text-amber-900 border border-amber-200 font-bold">
                          Sisa Pelunasan: {formatCurrency(task.remainingAmount)}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-emerald-50 rounded-lg text-emerald-800 border border-emerald-100">
                          Pelunasan: LUNAS
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: 1-Click Action Buttons */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-200 shrink-0">
                    {/* Primary Context Action Button */}
                    {(task.suggestedAction === 'CONFIRM' ||
                      task.taskType === 'CONFIRM_AND_DP') && (
                      <button
                        onClick={() =>
                          handleOpenActionModal(task.orderId, 'CONFIRM')
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-sm transition-colors w-full sm:w-auto"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        Konfirmasi Order & DP
                      </button>
                    )}

                    {task.taskType === 'VERIFY_PAYMENT' && (
                      <button
                        onClick={() =>
                          handleOpenActionModal(task.orderId, 'VERIFY_PAYMENT')
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 shadow-sm transition-colors w-full sm:w-auto"
                      >
                        <CurrencyDollarIcon className="w-4 h-4" />
                        Verifikasi Pembayaran
                      </button>
                    )}

                    {task.taskType === 'DELIVERY_DISPATCH' && (
                      <button
                        onClick={() =>
                          handleOpenActionModal(task.orderId, 'RELEASE')
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors w-full sm:w-auto"
                      >
                        <TruckIcon className="w-4 h-4" />
                        Kirim & Serah Terima
                      </button>
                    )}

                    {task.taskType === 'PICKUP_RETURN' && (
                      <button
                        onClick={() =>
                          handleOpenActionModal(task.orderId, 'PROCESS_RETURN')
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 shadow-sm transition-colors w-full sm:w-auto"
                      >
                        <ArrowUturnLeftIcon className="w-4 h-4" />
                        Proses Jemput / Retur
                      </button>
                    )}

                    {task.taskType === 'PICKUP_RETURN' &&
                      task.urgency === 'OVERDUE' && (
                        <Link
                          to={`/rental/orders/${task.orderId}`}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm transition-colors w-full sm:w-auto"
                        >
                          <ClockIcon className="w-4 h-4" />
                          Perpanjang Sewa
                        </Link>
                      )}

                    {task.taskType === 'SETTLE_RETURN' && (
                      <Link
                        to="/rental/returns"
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-sm transition-colors w-full sm:w-auto"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        Selesaikan Retur & Deposit
                      </Link>
                    )}

                    {task.taskType === 'PELUNASAN_PAYMENT' && (
                      <Link
                        to={`/rental/orders/${task.orderId}`}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-gray-800 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors w-full sm:w-auto"
                      >
                        <CurrencyDollarIcon className="w-4 h-4 text-purple-700" />
                        Detail Pelunasan Order
                      </Link>
                    )}

                    {/* Secondary Link to Order Detail */}
                    <Link
                      to={`/rental/orders/${task.orderId}`}
                      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 hover:underline"
                    >
                      Buka Rincian Order
                      <ChevronRightIcon className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Loading Modal Fallback while fetching order details */}
      {selectedOrderId && isLoadingSelectedOrder && !selectedOrderData && (
        <FormModal
          isOpen={isReleaseOpen || isVerifyPaymentOpen || isReturnOpen}
          onClose={() => {
            setIsReleaseOpen(false);
            setIsVerifyPaymentOpen(false);
            setIsReturnOpen(false);
            setSelectedOrderId(null);
          }}
          title="Memuat Rincian Pesanan..."
        >
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-500">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Menyiapkan data pesanan rental...</p>
          </div>
        </FormModal>
      )}

      {/* Modals for 1-Click Operations */}
      <ConfirmOrderModal
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setSelectedOrderId(null);
        }}
        orderId={selectedOrderId}
        onSuccess={handleActionSuccess}
      />

      <UnitAssignmentModal
        isOpen={isReleaseOpen && !!selectedOrderData}
        onClose={() => {
          setIsReleaseOpen(false);
          setSelectedOrderId(null);
        }}
        order={selectedOrderData ?? null}
        onSuccess={handleActionSuccess}
      />

      <VerifyPaymentModal
        isOpen={isVerifyPaymentOpen && !!selectedOrderData}
        onClose={() => {
          setIsVerifyPaymentOpen(false);
          setSelectedOrderId(null);
        }}
        order={selectedOrderData ?? null}
        onSuccess={handleActionSuccess}
      />

      <ReturnModal
        isOpen={isReturnOpen && !!selectedOrderData}
        onClose={() => {
          setIsReturnOpen(false);
          setSelectedOrderId(null);
        }}
        order={selectedOrderData ?? null}
        onSuccess={handleActionSuccess}
      />
    </PageContainer>
  );
}
