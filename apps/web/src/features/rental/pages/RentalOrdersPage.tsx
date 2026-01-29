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
import { apiAction } from '@/hooks/useApiAction';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from '@/utils/format';
import {
  PlusIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  TruckIcon,
  ArrowUturnLeftIcon,
  GlobeAltIcon,
  ComputerDesktopIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import {
  RentalOrderStatus,
  RentalPaymentStatus,
  OrderSource,
} from '@sync-erp/shared';
import type { RentalOrderWithRelations } from '@sync-erp/shared';
import UnitAssignmentModal from '../modals/UnitAssignmentModal';
import ConfirmOrderModal from '../modals/ConfirmOrderModal';
import CreateOrderModal from '../modals/CreateOrderModal';
import ReturnModal from '../modals/ReturnModal';
import VerifyPaymentModal from '../modals/VerifyPaymentModal';
import { OrderStatusFilter, SearchInput } from '../components';
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
} from '../constants';

const PAGE_SIZE = 50;

export default function RentalOrdersPage() {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  // Queries - extract items from paginated response
  const { data: ordersData, isLoading } =
    trpc.rental.orders.list.useQuery(
      { take: PAGE_SIZE },
      { enabled: !!currentCompany?.id }
    );
  const orders = ordersData?.items ?? [];

  // Mutations
  const cancelMutation = trpc.rental.orders.cancel.useMutation({
    onSuccess: () => utils.rental.orders.list.invalidate(),
  });

  // State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isReleaseOpen, setIsReleaseOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [isVerifyPaymentOpen, setIsVerifyPaymentOpen] =
    useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<
    string | null
  >(null);
  const [statusFilter, setStatusFilter] = useState<
    RentalOrderStatus | 'ALL'
  >('ALL');
  const [paymentFilter, setPaymentFilter] = useState<
    RentalPaymentStatus | 'ALL'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  // Filtered orders (client-side filtering by status and search)
  const filteredOrders = useMemo(() => {
    let result = orders;
    if (statusFilter !== 'ALL') {
      result = result.filter((o) => o.status === statusFilter);
    }
    if (paymentFilter !== 'ALL') {
      result = result.filter(
        (o) => o.rentalPaymentStatus === paymentFilter
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.orderNumber?.toLowerCase().includes(q) ||
          o.partner?.name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [orders, statusFilter, paymentFilter, searchQuery]);

  // Count orders awaiting payment verification
  const awaitingVerificationCount = useMemo(() => {
    return orders.filter(
      (o) =>
        o.rentalPaymentStatus === RentalPaymentStatus.AWAITING_CONFIRM
    ).length;
  }, [orders]);

  const openConfirmModal = (order: RentalOrderWithRelations) => {
    setSelectedOrderId(order.id);
    setIsConfirmOpen(true);
  };

  const openVerifyPaymentModal = (
    order: RentalOrderWithRelations
  ) => {
    setSelectedOrderId(order.id);
    setIsVerifyPaymentOpen(true);
  };

  const handleCancelOrder = async (orderId: string) => {
    await apiAction(
      () =>
        cancelMutation.mutateAsync({
          orderId,
          reason: 'Dibatalkan oleh staff',
        }),
      'Order dibatalkan'
    );
  };

  if (isLoading) return <LoadingState />;
  if (!currentCompany)
    return (
      <NoCompanySelected message="Pilih perusahaan untuk mengelola order rental." />
    );

  return (
    <PageContainer>
      <PageHeader
        title="Order Rental"
        description="Kelola pesanan rental dari customer"
        actions={
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <PlusIcon className="w-5 h-5" />
            Buat Order
          </button>
        }
      />

      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => setIsCreateOpen(false)}
      />

      {/* Confirm Order Modal */}
      <ConfirmOrderModal
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setSelectedOrderId(null);
        }}
        orderId={selectedOrderId}
        onSuccess={() => {
          setIsConfirmOpen(false);
          setSelectedOrderId(null);
        }}
      />

      {/* Verify Payment Modal */}
      <VerifyPaymentModal
        isOpen={isVerifyPaymentOpen}
        onClose={() => {
          setIsVerifyPaymentOpen(false);
          setSelectedOrderId(null);
        }}
        order={selectedOrder || null}
        onSuccess={() => {
          setIsVerifyPaymentOpen(false);
          setSelectedOrderId(null);
        }}
      />

      {/* Payment Verification Alert */}
      {awaitingVerificationCount > 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
          <CurrencyDollarIcon className="w-6 h-6 text-yellow-600 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-yellow-800">
              {awaitingVerificationCount} pembayaran menunggu
              verifikasi
            </p>
            <p className="text-sm text-yellow-700">
              Klik tombol "Verifikasi" pada order untuk mengkonfirmasi
              pembayaran
            </p>
          </div>
          <button
            onClick={() =>
              setPaymentFilter(RentalPaymentStatus.AWAITING_CONFIRM)
            }
            className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200"
          >
            Lihat
          </button>
        </div>
      )}

      {/* Search and Status Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="w-full sm:w-64">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Cari order atau customer..."
          />
        </div>
        <OrderStatusFilter
          value={statusFilter}
          onChange={setStatusFilter}
        />
        {/* Payment Status Filter */}
        <select
          value={paymentFilter}
          onChange={(e) =>
            setPaymentFilter(
              e.target.value as RentalPaymentStatus | 'ALL'
            )
          }
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="ALL">Semua Pembayaran</option>
          <option value={RentalPaymentStatus.PENDING}>
            Belum Bayar
          </option>
          <option value={RentalPaymentStatus.AWAITING_CONFIRM}>
            Menunggu Verifikasi
          </option>
          <option value={RentalPaymentStatus.CONFIRMED}>Lunas</option>
          <option value={RentalPaymentStatus.FAILED}>Gagal</option>
        </select>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardDocumentListIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Belum ada order
          </h3>
          <p className="text-gray-500 mb-4">
            Mulai dengan membuat order rental pertama
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg"
          >
            <PlusIcon className="w-5 h-5" />
            Buat Order
          </button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Order #
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Created At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Periode
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Total
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Pembayaran
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/rental/orders/${order.id}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      {order.orderSource === OrderSource.WEBSITE ? (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700"
                          title="Order dari Santi Living"
                        >
                          <GlobeAltIcon className="w-3 h-3" />
                          Website
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600"
                          title="Order dibuat manual"
                        >
                          <ComputerDesktopIcon className="w-3 h-3" />
                          Manual
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-gray-500 text-sm">
                    {order.createdAt
                      ? formatDateTime(new Date(order.createdAt))
                      : '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-900">
                    {order.partner?.name || '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    {formatDate(new Date(order.rentalStartDate))} -{' '}
                    {formatDate(new Date(order.rentalEndDate))}
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    {formatCurrency(Number(order.totalAmount))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${ORDER_STATUS_COLORS[order.status]}`}
                    >
                      {ORDER_STATUS_LABELS[order.status] ||
                        order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {order.rentalPaymentStatus && (
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${PAYMENT_STATUS_COLORS[order.rentalPaymentStatus] || 'bg-gray-100 text-gray-700'}`}
                      >
                        {PAYMENT_STATUS_LABELS[
                          order.rentalPaymentStatus
                        ] || order.rentalPaymentStatus}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {/* Verify Payment Button - highest priority for website orders */}
                      {order.rentalPaymentStatus ===
                        RentalPaymentStatus.AWAITING_CONFIRM && (
                        <button
                          onClick={() =>
                            openVerifyPaymentModal(order)
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100 animate-pulse"
                          title="Verifikasi Pembayaran"
                        >
                          <CurrencyDollarIcon className="w-4 h-4" />
                          Verifikasi
                        </button>
                      )}
                      {order.status === RentalOrderStatus.DRAFT && (
                        <>
                          <button
                            onClick={() => openConfirmModal(order)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100"
                            title="Konfirmasi & Terima Deposit"
                          >
                            <CheckCircleIcon className="w-4 h-4" />
                            Konfirmasi
                          </button>
                          <button
                            onClick={() =>
                              handleCancelOrder(order.id)
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"
                          >
                            Batalkan
                          </button>
                        </>
                      )}
                      {order.status ===
                        RentalOrderStatus.CONFIRMED && (
                        <button
                          onClick={() => {
                            setSelectedOrderId(order.id);
                            setIsReleaseOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                        >
                          <TruckIcon className="w-4 h-4" />
                          Serahkan
                        </button>
                      )}
                      {order.status === RentalOrderStatus.ACTIVE && (
                        <button
                          onClick={() => {
                            setSelectedOrderId(order.id);
                            setIsReturnOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
                        >
                          <ArrowUturnLeftIcon className="w-4 h-4" />
                          Proses Return
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Release Modal */}
      <UnitAssignmentModal
        isOpen={isReleaseOpen}
        onClose={() => {
          setIsReleaseOpen(false);
          setSelectedOrderId(null);
        }}
        order={selectedOrder || null}
        onSuccess={() => {
          setIsReleaseOpen(false);
          setSelectedOrderId(null);
          utils.rental.orders.list.invalidate();
        }}
      />

      {/* Return Modal */}
      <ReturnModal
        isOpen={isReturnOpen}
        onClose={() => {
          setIsReturnOpen(false);
          setSelectedOrderId(null);
        }}
        order={selectedOrder || null}
        onSuccess={() => {
          setIsReturnOpen(false);
          setSelectedOrderId(null);
          utils.rental.orders.list.invalidate();
        }}
      />
    </PageContainer>
  );
}
