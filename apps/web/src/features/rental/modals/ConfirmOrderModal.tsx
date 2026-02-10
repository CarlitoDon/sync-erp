import FormModal from '@/components/ui/FormModal';
import Select from '@/components/ui/Select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  CheckIcon,
  CubeIcon,
  BanknotesIcon,
  UserIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import QuickAddUnitsModal from './QuickAddUnitsModal';
import { useConfirmOrder } from '../hooks';

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
  const {
    order,
    isLoading,
    paymentMethods,
    availabilityCheck,
    totalItems,
    depositAmount,
    isPaymentPending,
    canConfirm,
    showQuickAddModal,
    manualMode,
    isConfirming,
    isManualConfirming,
    paymentMethodId,
    setPaymentMethodId,
    paymentAmount,
    setPaymentAmount,
    paymentReference,
    setPaymentReference,
    manualNotes,
    setManualNotes,
    skipStockCheck,
    setSkipStockCheck,
    handleConfirm,
    handleManualConfirm,
    handleQuickCreatePaymentMethod,
    handleCloseModal,
    handleOpenQuickAdd,
    handleCloseQuickAdd,
    handleQuickAddSuccess,
    enterManualMode,
  } = useConfirmOrder({ orderId, isOpen, onSuccess, onClose });

  if (!order && !isLoading) return null;

  return (
    <>
      <FormModal
        isOpen={isOpen}
        onClose={handleCloseModal}
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
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleOpenQuickAdd}
                    className="mt-3 w-full"
                  >
                    Konversi Stok ke Unit Rental
                  </Button>
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

              {/* Manual Override Section */}
              {!canConfirm && !manualMode && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                  <p className="text-sm text-amber-800 mb-2">
                    Order ini tidak bisa dikonfirmasi otomatis.
                    Gunakan konfirmasi manual jika pembayaran sudah
                    diterima.
                  </p>
                  <Button
                    size="sm"
                    onClick={enterManualMode}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    Konfirmasi Manual
                  </Button>
                </div>
              )}

              {/* Manual Confirm Form */}
              {manualMode && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-3">
                  <h4 className="font-medium text-blue-800">
                    Konfirmasi Manual
                  </h4>

                  <Select
                    label="Metode Pembayaran"
                    value={paymentMethodId}
                    onChange={setPaymentMethodId}
                    placeholder="Pilih metode pembayaran"
                    required
                    options={paymentMethods.map((pm) => ({
                      value: pm.id,
                      label: `${pm.name} (${pm.code})`,
                    }))}
                    onCreate={handleQuickCreatePaymentMethod}
                    createLabel="Tambah metode pembayaran"
                  />

                  <Input
                    label="Jumlah Pembayaran"
                    type="number"
                    value={paymentAmount}
                    onChange={(e) =>
                      setPaymentAmount(Number(e.target.value))
                    }
                  />

                  <Input
                    label="Referensi Pembayaran"
                    value={paymentReference}
                    onChange={(e) =>
                      setPaymentReference(e.target.value)
                    }
                    placeholder="No. transfer, bukti bayar, dll"
                  />

                  {!availabilityCheck.isAvailable && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="skipStock"
                        checked={skipStockCheck}
                        onChange={(e) =>
                          setSkipStockCheck(e.target.checked)
                        }
                        className="rounded"
                      />
                      <label
                        htmlFor="skipStock"
                        className="text-sm text-blue-700"
                      >
                        Lewati cek stok (konfirm meski unit kurang)
                      </label>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Catatan <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      placeholder="Alasan konfirmasi manual..."
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={handleCloseModal}>
                  Tutup
                </Button>
                {manualMode ? (
                  <Button
                    onClick={handleManualConfirm}
                    disabled={
                      !paymentMethodId ||
                      !manualNotes.trim() ||
                      isManualConfirming
                    }
                    isLoading={isManualConfirming}
                    loadingText="Mengkonfirmasi..."
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    <CheckIcon className="w-5 h-5" />
                    Konfirmasi Manual
                  </Button>
                ) : (
                  <Button
                    onClick={handleConfirm}
                    disabled={!canConfirm || isConfirming}
                    isLoading={isConfirming}
                    loadingText="Mengkonfirmasi..."
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckIcon className="w-5 h-5" />
                    Konfirmasi Order
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </FormModal>

      {/* Quick Add Units Modal */}
      <QuickAddUnitsModal
        isOpen={showQuickAddModal}
        onClose={handleCloseQuickAdd}
        shortages={availabilityCheck.shortages}
        onSuccess={handleQuickAddSuccess}
      />
    </>
  );
}
