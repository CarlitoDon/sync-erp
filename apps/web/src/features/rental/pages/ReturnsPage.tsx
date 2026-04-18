import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import FormModal from '@/components/ui/FormModal';
import { LoadingState, NoCompanySelected } from '@/components/ui';
import { Card } from '@/components/ui/Card';
import { apiAction } from '@/hooks/useApiAction';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'react-hot-toast';
import {
  ArrowUturnLeftIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import {
  RentalOrderStatus,
  UnitCondition,
  RentalOrderWithRelations,
} from '@sync-erp/shared';

const CONDITION_OPTIONS = [
  { value: UnitCondition.NEW, label: 'Baru/Sempurna' },
  { value: UnitCondition.GOOD, label: 'Baik' },
  { value: UnitCondition.FAIR, label: 'Cukup' },
  { value: UnitCondition.NEEDS_REPAIR, label: 'Perlu Perbaikan' },
];

const DAMAGE_SEVERITY_OPTIONS = [
  { value: '', label: 'Tidak Ada Kerusakan' },
  { value: 'MINOR', label: 'Ringan' },
  { value: 'MAJOR', label: 'Sedang' },
  { value: 'UNUSABLE', label: 'Tidak Bisa Dipakai' },
];

interface UnitReturnData {
  unitId: string;
  unitCode: string;
  condition: string;
  damageSeverity: string;
  damageNotes: string;
}

export default function ReturnsPage() {
  const { currentCompany } = useCompany();
  const [searchParams] = useSearchParams();
  const preselectedOrderId = searchParams.get('orderId');
  const utils = trpc.useUtils();

  // Queries - extract items from paginated response
  const { data: ordersData, isLoading } =
    trpc.rental.orders.list.useQuery(undefined, {
      enabled: !!currentCompany?.id,
    });
  const orders = ordersData?.items ?? [];

  // Mutations
  const processReturnMutation =
    trpc.rental.returns.process.useMutation({
      onSuccess: () => {
        utils.rental.orders.list.invalidate();
        setIsReturnModalOpen(false);
        setSelectedOrderId(null);
        resetReturnForm();
      },
    });

  // State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<
    string | null
  >(preselectedOrderId);
  const [returnForm, setReturnForm] = useState({
    actualReturnDate: new Date().toISOString().slice(0, 16),
    units: [] as UnitReturnData[],
  });

  // Filter only active orders that haven't been returned yet
  const activeOrders = useMemo(() => {
    return orders.filter(
      (o) => o.status === RentalOrderStatus.ACTIVE && !o.return
    );
  }, [orders]);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  // Calculate if order is overdue
  const getOverdueInfo = (order: RentalOrderWithRelations) => {
    const now = new Date();
    const dueDate = new Date(order.dueDateTime);
    const isOverdue = now > dueDate;
    const daysLate = isOverdue
      ? Math.ceil(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      : 0;
    return { isOverdue, daysLate };
  };

  if (isLoading) return <LoadingState />;
  if (!currentCompany)
    return (
      <NoCompanySelected message="Pilih perusahaan untuk mengelola return." />
    );

  const resetReturnForm = () => {
    setReturnForm({
      actualReturnDate: new Date().toISOString().slice(0, 16),
      units: [],
    });
  };

  const openReturnModal = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // Use real unit assignments from the order
    const assignments = order.unitAssignments || [];

    if (assignments.length === 0) {
      toast.error(
        'Tidak ada unit yang di-assign untuk order ini. Assign unit terlebih dahulu dari halaman detail order.'
      );
      return;
    }

    const unitEntries: UnitReturnData[] = assignments.map(
      (assignment) => ({
        unitId: assignment.rentalItemUnitId,
        unitCode: assignment.rentalItemUnit?.rentalItem?.product?.name
          ? `${assignment.rentalItemUnit.rentalItem.product.name} - ${assignment.rentalItemUnit?.unitCode || 'Unit'}`
          : assignment.rentalItemUnit?.unitCode || 'Unit',
        condition: UnitCondition.GOOD,
        damageSeverity: '',
        damageNotes: '',
      })
    );

    setReturnForm({
      actualReturnDate: new Date().toISOString().slice(0, 16),
      units: unitEntries,
    });
    setSelectedOrderId(orderId);
    setIsReturnModalOpen(true);
  };

  const updateUnitReturn = (
    index: number,
    field: keyof UnitReturnData,
    value: string
  ) => {
    const newUnits = [...returnForm.units];
    newUnits[index] = { ...newUnits[index], [field]: value };
    setReturnForm({ ...returnForm, units: newUnits });
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) return;

    // Use units directly (no longer need placeholder filter)
    const units = returnForm.units.map((u) => ({
      unitId: u.unitId,
      afterPhotos: [] as string[],
      condition: u.condition as
        | 'NEW'
        | 'GOOD'
        | 'FAIR'
        | 'NEEDS_REPAIR',
      damageSeverity: u.damageSeverity
        ? (u.damageSeverity as 'MINOR' | 'MAJOR' | 'UNUSABLE')
        : undefined,
      damageNotes: u.damageNotes || undefined,
    }));

    if (units.length === 0) {
      toast.error('Minimal satu unit harus dikembalikan.');
      return;
    }

    const payload = {
      orderId: selectedOrderId,
      actualReturnDate: new Date(returnForm.actualReturnDate),
      units: units as [(typeof units)[0], ...(typeof units)[0][]],
    };

    await apiAction(
      () => processReturnMutation.mutateAsync(payload),
      'Return berhasil diproses'
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Proses Return"
        description="Catat pengembalian barang rental dan hitung penalti"
      />

      {/* Return Modal */}
      <FormModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title={`Proses Return - ${selectedOrder?.orderNumber || ''}`}
      >
        <form
          onSubmit={handleProcessReturn}
          className="space-y-4 max-h-[70vh] overflow-y-auto"
        >
          {/* Order Summary */}
          {selectedOrder && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Customer:</span>
                <span className="font-medium">
                  {selectedOrder.partner?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Periode:</span>
                <span>
                  {formatDate(
                    new Date(selectedOrder.rentalStartDate)
                  )}{' '}
                  -{' '}
                  {formatDate(new Date(selectedOrder.rentalEndDate))}
                </span>
              </div>
              {getOverdueInfo(selectedOrder).isOverdue && (
                <div className="flex justify-between text-red-600">
                  <span>Terlambat:</span>
                  <span className="font-bold">
                    {getOverdueInfo(selectedOrder).daysLate} hari
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Return Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal Pengembalian
            </label>
            <input
              type="datetime-local"
              value={returnForm.actualReturnDate}
              onChange={(e) =>
                setReturnForm({
                  ...returnForm,
                  actualReturnDate: e.target.value,
                })
              }
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          {/* Unit Conditions */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Kondisi Unit
            </h4>
            <div className="space-y-3">
              {returnForm.units.map((unit, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-50 rounded-lg space-y-2"
                >
                  <div className="font-medium text-sm">
                    {unit.unitCode}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={unit.condition}
                      onChange={(e) =>
                        updateUnitReturn(
                          idx,
                          'condition',
                          e.target.value
                        )
                      }
                      className="px-2 py-1.5 text-sm border rounded"
                    >
                      {CONDITION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={unit.damageSeverity}
                      onChange={(e) =>
                        updateUnitReturn(
                          idx,
                          'damageSeverity',
                          e.target.value
                        )
                      }
                      className="px-2 py-1.5 text-sm border rounded"
                    >
                      {DAMAGE_SEVERITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {unit.damageSeverity && (
                    <textarea
                      placeholder="Catatan kerusakan..."
                      value={unit.damageNotes}
                      onChange={(e) =>
                        updateUnitReturn(
                          idx,
                          'damageNotes',
                          e.target.value
                        )
                      }
                      className="w-full px-2 py-1.5 text-sm border rounded"
                      rows={2}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsReturnModalOpen(false)}
              className="px-4 py-2 bg-gray-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={processReturnMutation.isPending}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
            >
              {processReturnMutation.isPending
                ? 'Memproses...'
                : 'Proses Return'}
            </button>
          </div>
        </form>
      </FormModal>

      {/* Active Orders List */}
      {activeOrders.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircleIcon className="w-12 h-12 mx-auto text-green-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Tidak ada rental aktif
          </h3>
          <p className="text-gray-500">
            Semua order sudah dikembalikan atau belum ada order aktif.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeOrders.map((order) => {
            const { isOverdue, daysLate } = getOverdueInfo(order);
            return (
              <Card
                key={order.id}
                className={`p-4 ${isOverdue ? 'border-red-300 bg-red-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        isOverdue ? 'bg-red-100' : 'bg-blue-100'
                      }`}
                    >
                      {isOverdue ? (
                        <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
                      ) : (
                        <ClockIcon className="w-6 h-6 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {order.orderNumber}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {order.partner?.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        Jatuh Tempo
                      </p>
                      <p
                        className={`font-medium ${
                          isOverdue ? 'text-red-600' : 'text-gray-900'
                        }`}
                      >
                        {formatDate(new Date(order.dueDateTime))}
                      </p>
                      {isOverdue && (
                        <p className="text-xs text-red-600 font-medium">
                          Terlambat {daysLate} hari
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(Number(order.totalAmount))}
                      </p>
                    </div>

                    <button
                      onClick={() => openReturnModal(order.id)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      <ArrowUturnLeftIcon className="w-4 h-4" />
                      Proses Return
                    </button>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="mt-3 pt-3 border-t flex gap-4 text-sm text-gray-600">
                  {order.items?.map((item) => (
                    <span key={item.id}>
                      {item.quantity}x{' '}
                      {item.rentalItem?.product?.name}
                    </span>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
