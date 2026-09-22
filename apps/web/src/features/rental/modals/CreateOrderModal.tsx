import FormModal from '@/components/ui/FormModal';
import { Input } from '@/components/ui';
import { formatCurrency } from '@/utils/format';
import {
  TrashIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline';
import QuickCreateCustomerModal from './QuickCreateCustomerModal';
import { useCreateOrder, getPricingTierLabel } from '../hooks';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateOrderModal({
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const {
    rentalItems,
    rentalBundles,
    customers,
    isLoadingData,
    rentalDays,
    subtotal,
    depositRequired,
    orderForm,
    updateFormField,
    isQuickCreateOpen,
    setIsQuickCreateOpen,
    isCreating,
    handleClose,
    handleSubmit,
    addItem,
    updateItem,
    updateItemType,
    removeItem,
    getAvailableUnits,
    handleQuickCreateSuccess,
  } = useCreateOrder({ isOpen, onSuccess, onClose });

  const deliveryFee = Number(orderForm.deliveryFee || 0);
  const discountAmount = Number(orderForm.discountAmount || 0);
  const totalAmount = Math.max(
    0,
    subtotal - discountAmount + deliveryFee
  );

  return (
    <>
      <FormModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Buat Order Rental Baru"
        maxWidth="2xl"
      >
        <form
          onSubmit={handleSubmit}
          className="space-y-4 pb-2"
        >
          {/* Loading State */}
          {isLoadingData ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-10 bg-gray-200 rounded" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-10 bg-gray-200 rounded" />
                <div className="h-10 bg-gray-200 rounded" />
              </div>
              <div className="h-24 bg-gray-200 rounded" />
            </div>
          ) : (
            <>
              {/* Customer Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Customer *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickCreateOpen(true)}
                    className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    <PlusCircleIcon className="w-4 h-4" />
                    Tambah Baru
                  </button>
                </div>
                <select
                  value={orderForm.partnerId}
                  onChange={(e) =>
                    updateFormField('partnerId', e.target.value)
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  required
                >
                  <option value="">Pilih customer...</option>
                  {customers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rental Period */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Tanggal Diantar *"
                  type="date"
                  value={orderForm.rentalStartDate}
                  onChange={(e) =>
                    updateFormField('rentalStartDate', e.target.value)
                  }
                  required
                />
                <Input
                  label="Tanggal Diambil *"
                  type="date"
                  value={orderForm.rentalEndDate}
                  onChange={(e) =>
                    updateFormField('rentalEndDate', e.target.value)
                  }
                  min={orderForm.rentalStartDate}
                  required
                />
              </div>

              {rentalDays > 0 && (
                <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-3.5 py-2 text-xs text-slate-600">
                  Durasi: <strong className="font-semibold text-slate-900">{rentalDays} hari</strong> ({getPricingTierLabel(rentalDays)})
                </div>
              )}

              {/* Items */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-800">
                    Item Rental
                  </h4>
                  <button
                    type="button"
                    onClick={addItem}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
                  >
                    <PlusCircleIcon className="h-4 w-4" />
                    Tambah Item
                  </button>
                </div>

                {orderForm.items.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Belum ada item. Klik &quot;+ Tambah Item&quot;
                    untuk memulai.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {orderForm.items.map((item, idx) => {
                      const rentalItem =
                        item.type === 'item'
                          ? rentalItems.find(
                              (ri) => ri.id === item.rentalItemId
                            )
                          : null;
                      const rentalBundle =
                        item.type === 'bundle'
                          ? rentalBundles.find(
                              (rb) => rb.id === item.rentalBundleId
                            )
                          : null;

                      const availableUnits =
                        item.type === 'item' && item.rentalItemId
                          ? getAvailableUnits(item.rentalItemId)
                          : 999;

                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3 transition-colors hover:border-slate-300"
                        >
                          {/* Row 1: Type, Item/Bundle selection, Qty, Trash */}
                          <div className="flex items-center gap-3">
                            <div className="w-28 shrink-0">
                              <select
                                value={item.type}
                                onChange={(e) =>
                                  updateItemType(
                                    idx,
                                    e.target.value as 'item' | 'bundle'
                                  )
                                }
                                className="w-full px-2.5 py-2 border rounded-lg text-sm bg-white font-medium text-slate-700 shadow-xs"
                              >
                                <option value="item">Item</option>
                                <option value="bundle">Bundle</option>
                              </select>
                            </div>

                            <div className="flex-1 min-w-0">
                              {item.type === 'item' ? (
                                <select
                                  value={item.rentalItemId || ''}
                                  onChange={(e) =>
                                    updateItem(
                                      idx,
                                      'rentalItemId',
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-800 shadow-xs"
                                  required
                                >
                                  <option value="">
                                    Pilih item rental...
                                  </option>
                                  {rentalItems.map((ri) => (
                                    <option key={ri.id} value={ri.id}>
                                      {ri.product?.name} (
                                      {getAvailableUnits(ri.id)} unit tersedia)
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <select
                                  value={item.rentalBundleId || ''}
                                  onChange={(e) =>
                                    updateItem(
                                      idx,
                                      'rentalBundleId',
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-800 shadow-xs"
                                  required
                                >
                                  <option value="">
                                    Pilih bundle paket...
                                  </option>
                                  {rentalBundles.map((rb) => (
                                    <option key={rb.id} value={rb.id}>
                                      {rb.name} (
                                      {formatCurrency(
                                        Number(rb.dailyRate)
                                      )}
                                      /hari)
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            <div className="w-20 shrink-0">
                              <input
                                type="number"
                                min={1}
                                max={availableUnits || 99}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItem(
                                    idx,
                                    'quantity',
                                    parseInt(e.target.value) || 1
                                  )
                                }
                                className="w-full px-2 py-2 border rounded-lg text-sm text-center font-semibold bg-white text-slate-800 shadow-xs"
                                required
                                title="Jumlah unit"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="shrink-0 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Hapus baris"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Row 2: Master tariff info & Price override */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200/60 text-xs">
                            <div className="text-slate-500">
                              {(rentalItem || rentalBundle) ? (
                                <span>
                                  Tarif master:{' '}
                                  <strong className="font-semibold text-slate-700">
                                    {formatCurrency(
                                      Number(
                                        rentalItem?.dailyRate ||
                                          rentalBundle?.dailyRate ||
                                          0
                                      )
                                    )}
                                  </strong>
                                  /hari
                                </span>
                              ) : (
                                <span className="italic text-slate-400">
                                  Pilih item untuk melihat tarif master
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="text-slate-500 whitespace-nowrap">
                                Harga khusus invoice:
                              </label>
                              <div className="relative w-64">
                                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-xs text-slate-400 pointer-events-none">
                                  Rp
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  value={item.pricePerDay ?? ''}
                                  onChange={(e) =>
                                    updateItem(
                                      idx,
                                      'pricePerDay',
                                      e.target.value
                                        ? Number(e.target.value)
                                        : undefined
                                    )
                                  }
                                  className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-xs bg-white text-slate-800 shadow-xs placeholder:text-slate-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                  placeholder="Kosongkan jika pakai master"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Layanan Tambahan & Logistik */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-slate-800 mb-3">
                  Layanan Khusus & Logistik
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Kasur Naik ke Lantai Atas"
                    type="number"
                    min={0}
                    value={orderForm.upstairsMattressCount}
                    onChange={(e) =>
                      updateFormField('upstairsMattressCount', e.target.value)
                    }
                    placeholder="0 unit kasur"
                  />
                  <Input
                    label="Kasur Dipasang Spreinya"
                    type="number"
                    min={0}
                    value={orderForm.fittedSheetCount}
                    onChange={(e) =>
                      updateFormField('fittedSheetCount', e.target.value)
                    }
                    placeholder="0 unit kasur"
                  />
                </div>
              </div>

              {/* Pengiriman & Lokasi */}
              <div className="border-t pt-4 space-y-3">
                <h4 className="text-sm font-semibold text-slate-800">
                  Pengiriman & Lokasi
                </h4>
                <Input
                  label="Link Google Maps Titik Pengiriman"
                  value={orderForm.googleMapsUrl}
                  onChange={(e) =>
                    updateFormField('googleMapsUrl', e.target.value)
                  }
                  placeholder="https://maps.app.goo.gl/... atau link titik koordinat"
                />
                <Input
                  label="Alamat / Patokan Pengiriman"
                  value={orderForm.deliveryAddress}
                  onChange={(e) =>
                    updateFormField('deliveryAddress', e.target.value)
                  }
                  placeholder="Nama jalan, nomor rumah, atau patokan lokasi..."
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Ongkos Kirim (Ongkir)"
                    type="number"
                    min={0}
                    value={orderForm.deliveryFee}
                    onChange={(e) =>
                      updateFormField('deliveryFee', e.target.value)
                    }
                    selectOnFocus
                    placeholder="0"
                  />
                  <Input
                    label="Diskon"
                    type="number"
                    min={0}
                    value={orderForm.discountAmount}
                    onChange={(e) =>
                      updateFormField('discountAmount', e.target.value)
                    }
                    selectOnFocus
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Keterangan Order */}
              <div className="border-t pt-4">
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Keterangan Order
                </label>
                <textarea
                  value={orderForm.notes}
                  onChange={(e) => updateFormField('notes', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white border-slate-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 shadow-xs"
                  rows={2}
                  placeholder="Catatan instruksi untuk kurir, waktu antar, atau keterangan pesanan lainnya..."
                />
              </div>

              {/* Summary */}
              {orderForm.items.length > 0 && rentalDays > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-2.5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>
                      Subtotal ({orderForm.items.length} item × {rentalDays} hari)
                    </span>
                    <span className="font-medium text-slate-800">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Ongkos Kirim (Ongkir)</span>
                      <span className="font-medium text-slate-800">
                        +{formatCurrency(deliveryFee)}
                      </span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Diskon</span>
                      <span className="font-medium text-rose-600">
                        -{formatCurrency(discountAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total Akhir</span>
                    <span className="text-primary-700">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-slate-500">
                      Deposit yang diperlukan
                    </span>
                    <span className="font-semibold text-amber-600">
                      {formatCurrency(depositRequired)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={
                    isCreating || orderForm.items.length === 0
                  }
                  className="px-6 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isCreating ? 'Menyimpan...' : 'Buat Order'}
                </button>
              </div>
            </>
          )}
        </form>
      </FormModal>

      <QuickCreateCustomerModal
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
        onSuccess={handleQuickCreateSuccess}
        zIndex="z-[60]"
      />
    </>
  );
}
