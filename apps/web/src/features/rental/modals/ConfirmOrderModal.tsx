import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import FormModal from '@/components/ui/FormModal';
import { apiAction } from '@/hooks/useApiAction';
import {
  CheckIcon,
  CubeIcon,
  BanknotesIcon,
  UserIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { RentalPaymentStatus } from '@sync-erp/shared';
import QuickAddUnitsModal from './QuickAddUnitsModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
  onSuccess: () => void;
}

export default function ConfirmOrderModal({
  isOpen,
  onClose,
  orderId,
  onSuccess,
}: Props) {
  const utils = trpc.useUtils();
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);

  // Fetch complete order data
  const { data: order, isLoading } =
    trpc.rental.orders.getById.useQuery(
      { id: orderId! },
      { enabled: isOpen && !!orderId }
    );

  // Fetch rental items to check availability
  const { data: rentalItems = [] } = trpc.rental.items.list.useQuery(
    undefined,
    { enabled: isOpen }
  );

  // Calculate unit requirements and availability
  const availabilityCheck = useMemo(() => {
    if (!order?.items) return { shortages: [], isAvailable: true };

    const shortages: {
      rentalItemId: string;
      productName: string;
      productSku: string;
      required: number;
      available: number;
      shortage: number;
    }[] = [];

    // Check each order item
    order.items.forEach((item) => {
      if (item.rentalBundleId && item.rentalBundle?.components) {
        // Bundle: check each component
        item.rentalBundle.components.forEach((comp) => {
          const rentalItem = rentalItems.find(
            (ri) => ri.id === comp.rentalItem?.id
          );
          if (!rentalItem) return;

          const available =
            rentalItem.units?.filter((u) => u.status === 'AVAILABLE')
              .length || 0;
          const required = comp.quantity * item.quantity;

          if (available < required) {
            const existing = shortages.find(
              (s) => s.rentalItemId === rentalItem.id
            );
            if (existing) {
              existing.required += required;
              existing.shortage =
                existing.required - existing.available;
            } else {
              shortages.push({
                rentalItemId: rentalItem.id,
                productName: rentalItem.product?.name || 'Unknown',
                productSku: rentalItem.product?.sku || '',
                required,
                available,
                shortage: required - available,
              });
            }
          }
        });
      } else if (item.rentalItemId) {
        // Standalone item
        const rentalItem = rentalItems.find(
          (ri) => ri.id === item.rentalItemId
        );
        if (!rentalItem) return;

        const available =
          rentalItem.units?.filter((u) => u.status === 'AVAILABLE')
            .length || 0;
        const required = item.quantity;

        if (available < required) {
          shortages.push({
            rentalItemId: rentalItem.id,
            productName: rentalItem.product?.name || 'Unknown',
            productSku: rentalItem.product?.sku || '',
            required,
            available,
            shortage: required - available,
          });
        }
      }
    });

    return { shortages, isAvailable: shortages.length === 0 };
  }, [order?.items, rentalItems]);

  // Check payment status
  const paymentStatus = order?.rentalPaymentStatus;
  const isPaymentVerified =
    paymentStatus === RentalPaymentStatus.CONFIRMED ||
    paymentStatus === RentalPaymentStatus.AWAITING_CONFIRM;
  const isPaymentPending =
    paymentStatus === RentalPaymentStatus.PENDING;

  // Can only confirm if payment verified AND units available
  const canConfirm =
    isPaymentVerified && availabilityCheck.isAvailable;

  const confirmMutation = trpc.rental.orders.confirm.useMutation({
    onSuccess: () => {
      utils.rental.orders.list.invalidate();
      utils.rental.orders.getById.invalidate({ id: orderId! });
      onSuccess();
      onClose();
    },
  });

  const handleConfirm = async () => {
    if (!order || !canConfirm) return;

    await apiAction(
      () => confirmMutation.mutateAsync({ orderId: order.id }),
      'Order dikonfirmasi! Unit otomatis di-assign.'
    );
  };

  if (!order && !isLoading) return null;

  // Calculate total items
  const totalItems =
    order?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  // Get deposit from order (already calculated)
  const depositAmount = order?.depositAmount
    ? Number(order.depositAmount)
    : 0;

  return (
    <>
      <FormModal
        isOpen={isOpen}
        onClose={onClose}
        title={`Konfirmasi Order - ${order?.orderNumber || '...'}`}
      >
        <div className="space-y-4">
          {isLoading ? (
            <div className="py-8 text-center text-gray-500">
              Memuat data order...
            </div>
          ) : (
            <>
              {/* Payment Status Warning */}
              {isPaymentPending && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-800 font-medium">
                    <ClockIcon className="w-5 h-5" />
                    Menunggu Pembayaran
                  </div>
                  <p className="text-sm text-amber-700 mt-1">
                    Order ini belum bisa dikonfirmasi karena customer
                    belum melakukan pembayaran. Tunggu bukti
                    pembayaran dari customer.
                  </p>
                </div>
              )}

              {/* Unit Shortage Warning */}
              {!availabilityCheck.isAvailable && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800 font-medium mb-3">
                    <ExclamationTriangleIcon className="w-5 h-5" />
                    Unit Tidak Cukup
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-red-700 border-b border-red-200">
                        <th className="pb-2">Item</th>
                        <th className="pb-2 text-center">Butuh</th>
                        <th className="pb-2 text-center">Tersedia</th>
                        <th className="pb-2 text-center">Kurang</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availabilityCheck.shortages.map((s, idx) => (
                        <tr
                          key={`${s.rentalItemId}-${idx}`}
                          className="text-red-700"
                        >
                          <td className="py-1">{s.productName}</td>
                          <td className="py-1 text-center">
                            {s.required}
                          </td>
                          <td className="py-1 text-center">
                            {s.available}
                          </td>
                          <td className="py-1 text-center font-medium">
                            {s.shortage}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddModal(true)}
                    className="mt-3 w-full px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 text-sm font-medium"
                  >
                    Konversi Stok ke Unit Rental
                  </button>
                </div>
              )}

              {/* Order Summary */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-gray-700">
                  <UserIcon className="w-4 h-4" />
                  <span className="font-medium">
                    {order?.partner?.name || 'Customer'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <CalendarIcon className="w-4 h-4" />
                  <span>
                    {order?.rentalStartDate
                      ? new Date(
                          order.rentalStartDate
                        ).toLocaleDateString('id-ID')
                      : '-'}{' '}
                    -{' '}
                    {order?.rentalEndDate
                      ? new Date(
                          order.rentalEndDate
                        ).toLocaleDateString('id-ID')
                      : '-'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <CubeIcon className="w-4 h-4" />
                  <span>{totalItems} item</span>
                </div>

                {depositAmount > 0 && (
                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <BanknotesIcon className="w-4 h-4" />
                    <span>
                      Deposit: Rp{' '}
                      {depositAmount.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
              </div>

              {/* Order Items */}
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {order?.items?.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {item.rentalBundle?.name ||
                          item.rentalItem?.product?.name ||
                          'Item'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.quantity} unit × Rp{' '}
                        {Number(item.unitPrice).toLocaleString(
                          'id-ID'
                        )}
                      </p>
                    </div>
                    <p className="font-medium">
                      Rp{' '}
                      {Number(item.subtotal).toLocaleString('id-ID')}
                    </p>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex justify-between items-center pt-2 border-t font-semibold">
                <span>Total</span>
                <span className="text-lg text-primary-600">
                  Rp{' '}
                  {Number(order?.totalAmount || 0).toLocaleString(
                    'id-ID'
                  )}
                </span>
              </div>

              {/* Info Box - only show if can confirm */}
              {canConfirm && (
                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                  <p>
                    <strong>Konfirmasi akan:</strong>
                  </p>
                  <ul className="list-disc list-inside mt-1 text-xs space-y-1">
                    <li>Otomatis assign unit yang tersedia</li>
                    <li>Reserve unit untuk order ini</li>
                    <li>Mengubah status order menjadi CONFIRMED</li>
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!canConfirm || confirmMutation.isPending}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <CheckIcon className="w-5 h-5" />
                  {confirmMutation.isPending
                    ? 'Mengkonfirmasi...'
                    : 'Konfirmasi Order'}
                </button>
              </div>
            </>
          )}
        </div>
      </FormModal>

      {/* Quick Add Units Modal */}
      <QuickAddUnitsModal
        isOpen={showQuickAddModal}
        onClose={() => setShowQuickAddModal(false)}
        shortages={availabilityCheck.shortages}
        onSuccess={() => {
          utils.rental.items.list.invalidate();
          setShowQuickAddModal(false);
        }}
      />
    </>
  );
}
