import { useMemo, useState } from 'react';
import FormModal from '@/components/ui/FormModal';
import { Input } from '@/components/ui';
import Select from '@/components/ui/Select';
import { formatCurrency } from '@/utils/format';
import {
  TrashIcon,
  PlusCircleIcon,
  MapPinIcon,
  ArrowPathIcon,
  ClipboardDocumentCheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import QuickCreateCustomerModal from './QuickCreateCustomerModal';
import MapSelectorModal from './MapSelectorModal';
import {
  useCreateOrder,
  getPricingTierLabel,
  calculateLineTotal,
  type EditableRentalOrder,
} from '../hooks';
import { trpc } from '@/lib/trpc';
import { toast } from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialItemId?: string;
  editingOrder?: EditableRentalOrder | null;
}

export default function CreateOrderModal({
  isOpen,
  onClose,
  onSuccess,
  initialItemId,
  editingOrder,
}: Props) {
  const {
    rentalItems,
    rentalBundles,
    customers,
    partnerAddresses,
    isLoadingData,
    rentalDays,
    subtotal,
    totalMattressesInOrder,
    stockConflicts,
    hasStockError: crossStockError,
    getDynamicRemainingForLine,
    upstairsFeePerUnit,
    fittedSheetFeePerUnit,
    upstairsTotalFee,
    fittedSheetTotalFee,
    specialServicesTotalFee,
    orderForm,
    updateFormField,
    isQuickCreateOpen,
    setIsQuickCreateOpen,
    isDirty,
    isEditing,
    isCreating,
    handleClose,
    handleSubmit,
    addItem,
    updateItem,
    updateItemUnified,
    updateItemQuantity,
    applyLocationData,
    selectSavedAddress,
    removeItem,
    getAvailableUnits,
    getBundleAvailableUnits,
    handleQuickCreateSuccess,
  } = useCreateOrder({
    isOpen,
    onSuccess,
    onClose,
    initialItemId,
    editingOrder,
  });

  const [isMapSelectorOpen, setIsMapSelectorOpen] = useState(false);
  const [showDetailedAddress, setShowDetailedAddress] = useState(false);

  const extractUrlMutation = trpc.maps.extractFromUrl.useMutation();

  const deliveryFee = Number(orderForm.deliveryFee || 0);
  const discountAmount = Number(orderForm.discountAmount || 0);
  const totalAmount = Math.max(
    0,
    subtotal - discountAmount + deliveryFee + (specialServicesTotalFee || 0)
  );

  const customerOptions = useMemo(() => {
    return customers.map((p) => ({
      value: p.id,
      label: p.phone ? `${p.name} (${p.phone})` : p.name,
    }));
  }, [customers]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === orderForm.partnerId);
  }, [customers, orderForm.partnerId]);

  const hasStockError = useMemo(() => {
    return orderForm.items.some((item) => {
      const qty = Number(item.quantity || 0);
      if (qty <= 0) return false;
      if (item.type === 'item' && item.rentalItemId) {
        const avail = getAvailableUnits(item.rentalItemId);
        return qty > avail;
      }
      if (item.type === 'bundle' && item.rentalBundleId) {
        const avail = getBundleAvailableUnits(item.rentalBundleId);
        return qty > avail;
      }
      return false;
    });
  }, [orderForm.items, getAvailableUnits, getBundleAvailableUnits]);

  const hasOverallStockError =
    hasStockError ||
    Boolean(crossStockError) ||
    Boolean(stockConflicts && stockConflicts.length > 0);

  // Unified items grouped dynamically by RentalItemCategory table name
  const unifiedItemGroups = useMemo(() => {
    const bundleOptions = rentalBundles.map((rb) => {
      const available = getBundleAvailableUnits(rb.id);
      return {
        value: `bundle:${rb.id}`,
        label: `${rb.name} (${formatCurrency(Number(rb.dailyRate))}/hari • ${available} paket)`,
      };
    });

    // Group items dynamically by their RentalItemCategory table name
    const categoryGroupsMap = new Map<string, { value: string; label: string }[]>();

    rentalItems.forEach((ri) => {
      const productName = ri.product?.name || '';
      const categoryName = ri.category?.name || 'Item Extras & Aksesoris';
      const available = getAvailableUnits(ri.id);
      const opt = {
        value: `item:${ri.id}`,
        label: `${productName} (${formatCurrency(Number(ri.dailyRate))}/hari • ${available} unit)`,
      };

      if (!categoryGroupsMap.has(categoryName)) {
        categoryGroupsMap.set(categoryName, []);
      }
      categoryGroupsMap.get(categoryName)!.push(opt);
    });

    const groups: {
      label: string;
      options: { value: string; label: string }[];
    }[] = [];

    // 1. Paket Bundles always at the top
    if (bundleOptions.length > 0) {
      groups.push({
        label: 'Paket (Bundle Kasur Lengkap)',
        options: bundleOptions,
      });
    }

    // 2. Mattress category second (e.g. "Kasur" or "Kasur Saja")
    for (const [catName, options] of categoryGroupsMap.entries()) {
      if (catName.toLowerCase().includes('kasur')) {
        groups.push({
          label: catName,
          options,
        });
      }
    }

    // 3. Other categories sorted alphabetically (e.g. "Karpet", "Kursi", "Elektronik & Pendingin")
    const otherCategories = Array.from(categoryGroupsMap.entries())
      .filter(
        ([catName]) =>
          !catName.toLowerCase().includes('kasur') &&
          catName !== 'Item Extras & Aksesoris' &&
          catName !== 'Lainnya'
      )
      .sort((a, b) => a[0].localeCompare(b[0]));

    for (const [catName, options] of otherCategories) {
      groups.push({
        label: catName,
        options,
      });
    }

    // 4. Extras / Aksesoris / Lainnya at the bottom
    for (const [catName, options] of categoryGroupsMap.entries()) {
      if (catName === 'Item Extras & Aksesoris' || catName === 'Lainnya') {
        groups.push({
          label: catName,
          options,
        });
      }
    }

    return groups;
  }, [rentalBundles, rentalItems, getAvailableUnits, getBundleAvailableUnits]);

  // Saved addresses options for the selected customer
  const savedAddressOptions = useMemo(() => {
    const options = partnerAddresses.map((addr) => ({
      value: addr.id,
      label: `${addr.isDefault ? '[Utama] ' : ''}${addr.name ? `${addr.name}: ` : ''}${addr.street || addr.address || `${addr.kecamatan || ''}, ${addr.kota || ''}`}`,
    }));
    return [
      { value: '', label: '+ Masukkan / Tentukan Alamat Baru' },
      ...options,
    ];
  }, [partnerAddresses]);

  const handleExtractMapsUrl = async () => {
    if (!orderForm.googleMapsUrl?.trim()) return;
    try {
      const res = await extractUrlMutation.mutateAsync({
        url: orderForm.googleMapsUrl.trim(),
      });
      applyLocationData(res);
      setShowDetailedAddress(true);
      toast.success('Alamat berhasil diekstrak dari link Google Maps!');
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Gagal mengekstrak alamat dari link Google Maps'
      );
    }
  };

  const handleOpenMapSelector = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsMapSelectorOpen(true);
  };

  const handleCancelClick = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        isEditing
          ? 'Ada perubahan data yang belum disimpan. Yakin ingin membatalkan perubahan order draft ini?'
          : 'Ada data yang sudah diisi. Yakin ingin membatalkan pembuatan order draft ini?'
      );
      if (!confirmed) return;
    }
    handleClose();
  };

  return (
    <>
      <FormModal
        isOpen={isOpen}
        onClose={handleCancelClick}
        disableBackdropClick={true}
        title={
          isEditing
            ? `Edit Order Draft #${editingOrder?.orderNumber || ''}`
            : 'Buat Order Rental Baru'
        }
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6 pb-2">
          {/* Loading State */}
          {isLoadingData ? (
            <div className="space-y-5 animate-pulse">
              <div className="h-12 bg-gray-200 rounded-xl" />
              <div className="grid grid-cols-2 gap-5">
                <div className="h-28 bg-gray-200 rounded-xl" />
                <div className="h-28 bg-gray-200 rounded-xl" />
              </div>
              <div className="h-32 bg-gray-200 rounded-xl" />
            </div>
          ) : (
            <>
              {/* Card 1: Customer & Periode Sewa */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 sm:p-6 space-y-5 shadow-2xs">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200/60 gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 tracking-tight">
                      Customer & Periode Sewa
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pilih customer dan tentukan rentang tanggal & waktu pengantaran/pengambilan
                    </p>
                  </div>
                  {rentalDays > 0 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200/80">
                      Durasi: {rentalDays} hari ({getPricingTierLabel(rentalDays)})
                    </span>
                  )}
                </div>

                {/* Customer selection */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Customer <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsQuickCreateOpen(true)}
                      className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-semibold cursor-pointer transition-colors"
                    >
                      <PlusCircleIcon className="w-4 h-4" />
                      Tambah Baru
                    </button>
                  </div>
                  <Select
                    value={orderForm.partnerId}
                    onChange={(val) => updateFormField('partnerId', val)}
                    options={customerOptions}
                    placeholder="Pilih customer..."
                    searchable={true}
                    allowCreate={true}
                    onCreate={() => setIsQuickCreateOpen(true)}
                    createLabel="Tambah Customer Baru"
                    portal={true}
                  />
                </div>

                {/* Rental Period & Times */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                  <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200/70 shadow-2xs">
                    <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Jadwal Pengantaran
                    </div>
                    <Input
                      label="Tanggal Diantar"
                      type="date"
                      value={orderForm.rentalStartDate}
                      onChange={(e) =>
                        updateFormField('rentalStartDate', e.target.value)
                      }
                      required
                    />
                    <Input
                      label="Jam Diantar"
                      type="time"
                      value={orderForm.deliveryTime}
                      onChange={(e) =>
                        updateFormField('deliveryTime', e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200/70 shadow-2xs">
                    <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Jadwal Pengambilan
                    </div>
                    <Input
                      label="Tanggal Diambil"
                      type="date"
                      value={orderForm.rentalEndDate}
                      onChange={(e) =>
                        updateFormField('rentalEndDate', e.target.value)
                      }
                      min={orderForm.rentalStartDate}
                      required
                    />
                    <Input
                      label="Jam Diambil"
                      type="time"
                      value={orderForm.pickupTime}
                      onChange={(e) =>
                        updateFormField('pickupTime', e.target.value)
                      }
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Item Rental */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 tracking-tight">
                      Item Rental
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pilih paket kasur lengkap, kasur satuan, atau perlengkapan tidur ekstra
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200/70 cursor-pointer transition-colors shadow-2xs self-start sm:self-auto"
                  >
                    <PlusCircleIcon className="h-4 w-4" />
                    Tambah Item
                  </button>
                </div>

                {orderForm.items.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Belum ada item. Klik &quot;+ Tambah Item&quot; untuk memulai.
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
                          : item.type === 'bundle' && item.rentalBundleId
                            ? getBundleAvailableUnits(item.rentalBundleId)
                            : 99;

                      const targetId =
                        (item.type === 'item'
                          ? item.rentalItemId
                          : item.rentalBundleId) || '';

                      const hasSelected = Boolean(
                        item.rentalItemId || item.rentalBundleId
                      );

                      const dynamicRemaining =
                        hasSelected && targetId && getDynamicRemainingForLine
                          ? getDynamicRemainingForLine(
                              idx,
                              item.type,
                              targetId
                            )
                          : availableUnits;

                      const maxStock = targetId ? dynamicRemaining : availableUnits;
                      const isOverStock =
                        hasSelected &&
                        Number(item.quantity || 0) > maxStock;
                      const isOutOfStock =
                        hasSelected && (availableUnits === 0 || maxStock === 0);

                      const currentValue =
                        item.type === 'bundle'
                          ? item.rentalBundleId
                            ? `bundle:${item.rentalBundleId}`
                            : ''
                          : item.rentalItemId
                            ? `item:${item.rentalItemId}`
                            : '';

                      return (
                        <div
                          key={idx}
                          className={`rounded-xl border p-3.5 space-y-2.5 shadow-2xs transition-colors ${
                            isOutOfStock || isOverStock
                              ? 'border-rose-300 bg-rose-50/20 hover:border-rose-400'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          {/* Row 1: Unified Select (Custom dropdown), Qty input (backspace-friendly & capped), Trash */}
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 min-w-0">
                              <Select
                                value={currentValue}
                                onChange={(val) =>
                                  updateItemUnified(idx, val)
                                }
                                groups={unifiedItemGroups}
                                placeholder="Pilih paket, kasur saja, atau item extras..."
                                searchable={true}
                                allowCreate={false}
                                portal={true}
                              />
                            </div>

                            <div className="w-20 shrink-0">
                              <input
                                type="number"
                                min={1}
                                max={maxStock > 0 ? maxStock : 1}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '') {
                                    updateItemQuantity(idx, '');
                                    return;
                                  }
                                  const num = parseInt(val, 10);
                                  if (isNaN(num)) return;
                                  // Cap quantity at maxStock if item/bundle is selected and has stock
                                  const capped =
                                    hasSelected && maxStock > 0
                                      ? Math.min(num, maxStock)
                                      : num;
                                  updateItemQuantity(idx, Math.max(1, capped));
                                }}
                                onBlur={() => {
                                  if (
                                    item.quantity === '' ||
                                    Number(item.quantity) < 1
                                  ) {
                                    updateItemQuantity(idx, 1);
                                  }
                                }}
                                placeholder="1"
                                className={`w-full px-2 py-2 border rounded-lg text-sm text-center font-semibold bg-white text-slate-800 shadow-2xs ${
                                  isOverStock || isOutOfStock
                                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/40 text-rose-900'
                                    : 'border-slate-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500'
                                }`}
                                required
                                title={
                                  hasSelected
                                    ? maxStock < availableUnits
                                      ? `Sisa tersedia: ${maxStock} unit/paket (Total gudang: ${availableUnits})`
                                      : `Tersedia: ${availableUnits} unit/paket`
                                    : 'Jumlah unit'
                                }
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="shrink-0 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus baris"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Row 2: Consistent Fixed Grid - Master tariff info & Price override */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs items-center">
                            <div className="flex items-center min-h-[30px] text-slate-500">
                              {rentalItem || rentalBundle ? (
                                <span className="truncate flex items-center flex-wrap gap-1">
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
                                  {maxStock === 0 ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700">
                                      Stok Habis (0 {item.type === 'bundle' ? 'paket' : 'unit'})
                                    </span>
                                  ) : isOverStock ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700">
                                      Maks {maxStock} {item.type === 'bundle' ? 'paket' : 'unit'}
                                    </span>
                                  ) : maxStock < availableUnits ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                                      Sisa {maxStock} {item.type === 'bundle' ? 'paket' : 'unit'} (gudang: {availableUnits})
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">
                                      ({availableUnits} {item.type === 'bundle' ? 'paket' : 'unit'} tersedia)
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-400">
                                  Tarif master:{' '}
                                  <span className="font-medium">-</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-start sm:justify-end gap-2 min-h-[30px]">
                              <label className="text-slate-500 whitespace-nowrap text-xs">
                                Harga khusus invoice:
                              </label>
                              <div className="relative w-44">
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
                                  className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 shadow-2xs placeholder:text-slate-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                  placeholder="Sesuai master"
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

              {/* Card 3: Layanan Khusus & Logistik */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 sm:p-6 space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200/60 gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 tracking-tight">
                      Layanan Khusus & Logistik
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {totalMattressesInOrder > 0
                        ? `Maksimal ${totalMattressesInOrder} kasur sesuai total kasur fisik dalam pesanan.`
                        : 'Belum ada kasur dalam pesanan. Tambahkan kasur atau paket kasur untuk mengaktifkan layanan ini.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-2xs">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 font-medium">
                      Naik Lantai: {formatCurrency(upstairsFeePerUnit)}/kasur
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-medium">
                      Pasang Sprei: {formatCurrency(fittedSheetFeePerUnit)}/kasur
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                  <div>
                    <Input
                      label="Kasur Naik ke Lantai Atas"
                      type="number"
                      min={0}
                      max={totalMattressesInOrder}
                      disabled={totalMattressesInOrder === 0}
                      value={orderForm.upstairsMattressCount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          updateFormField('upstairsMattressCount', '');
                          return;
                        }
                        const num = parseInt(val, 10);
                        if (isNaN(num)) return;
                        const capped = Math.min(Math.max(0, num), totalMattressesInOrder);
                        updateFormField('upstairsMattressCount', String(capped));
                      }}
                      placeholder={
                        totalMattressesInOrder === 0
                          ? '0 (tidak ada kasur)'
                          : `0 (maks ${totalMattressesInOrder} kasur)`
                      }
                    />
                    {upstairsTotalFee > 0 && (
                      <p className="text-2xs text-blue-600 mt-1.5 font-medium">
                        Biaya: +{formatCurrency(upstairsTotalFee)} ({orderForm.upstairsMattressCount} x {formatCurrency(upstairsFeePerUnit)})
                      </p>
                    )}
                  </div>

                  <div>
                    <Input
                      label="Kasur Dipasang Spreinya"
                      type="number"
                      min={0}
                      max={totalMattressesInOrder}
                      disabled={totalMattressesInOrder === 0}
                      value={orderForm.fittedSheetCount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          updateFormField('fittedSheetCount', '');
                          return;
                        }
                        const num = parseInt(val, 10);
                        if (isNaN(num)) return;
                        const capped = Math.min(Math.max(0, num), totalMattressesInOrder);
                        updateFormField('fittedSheetCount', String(capped));
                      }}
                      placeholder={
                        totalMattressesInOrder === 0
                          ? '0 (tidak ada kasur)'
                          : `0 (maks ${totalMattressesInOrder} kasur)`
                      }
                    />
                    {fittedSheetTotalFee > 0 && (
                      <p className="text-2xs text-indigo-600 mt-1.5 font-medium">
                        Biaya: +{formatCurrency(fittedSheetTotalFee)} ({orderForm.fittedSheetCount} x {formatCurrency(fittedSheetFeePerUnit)})
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 4: Pengiriman & Lokasi */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 tracking-tight">
                      Pengiriman & Lokasi
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Detail alamat, titik Google Maps, dan ongkos kirim
                    </p>
                  </div>
                  {typeof orderForm.latitude === 'number' &&
                    typeof orderForm.longitude === 'number' && (
                      <span className="text-2xs font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        📍 {orderForm.latitude.toFixed(5)},{' '}
                        {orderForm.longitude.toFixed(5)}
                      </span>
                    )}
                </div>

                {/* Saved addresses selector if customer has saved addresses */}
                {partnerAddresses.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Alamat Tersimpan Customer
                    </label>
                    <Select
                      value={orderForm.selectedCustomerAddressId}
                      onChange={(val) => selectSavedAddress(val)}
                      options={savedAddressOptions}
                      placeholder="Pilih alamat tersimpan..."
                      allowCreate={false}
                      portal={true}
                    />
                  </div>
                )}

                {/* Link Google Maps with Extract & Map Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Link Google Maps Titik Pengiriman
                    </label>
                    <button
                      type="button"
                      onClick={handleOpenMapSelector}
                      className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-semibold cursor-pointer"
                    >
                      <MapPinIcon className="w-3.5 h-3.5" />
                      Pilih di Peta
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={orderForm.googleMapsUrl}
                      onChange={(e) =>
                        updateFormField('googleMapsUrl', e.target.value)
                      }
                      placeholder="https://maps.app.goo.gl/... atau koordinat"
                      className="flex-1 px-3 py-2 border rounded-xl text-sm bg-white text-slate-800 shadow-2xs border-slate-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={handleExtractMapsUrl}
                      disabled={
                        extractUrlMutation.isPending ||
                        !orderForm.googleMapsUrl?.trim()
                      }
                      className="px-3.5 py-2 bg-slate-800 text-white rounded-xl text-xs font-medium hover:bg-slate-700 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors shadow-2xs"
                    >
                      {extractUrlMutation.isPending ? (
                        <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ClipboardDocumentCheckIcon className="w-3.5 h-3.5" />
                      )}
                      Ekstrak Alamat
                    </button>
                  </div>
                </div>

                {/* Primary Delivery Address Input */}
                <Input
                  label="Alamat / Patokan Pengiriman"
                  value={orderForm.deliveryAddress}
                  onChange={(e) =>
                    updateFormField('deliveryAddress', e.target.value)
                  }
                  placeholder="Nama jalan, nomor rumah, atau patokan lokasi..."
                  required
                />

                {/* Toggle Structured Address Fields */}
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setShowDetailedAddress((prev) => !prev)
                    }
                    className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 cursor-pointer font-medium"
                  >
                    {showDetailedAddress ? (
                      <ChevronUpIcon className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDownIcon className="w-3.5 h-3.5" />
                    )}
                    {showDetailedAddress
                      ? 'Sembunyikan Rincian Wilayah (Kelurahan, Kecamatan, Kota)'
                      : 'Tampilkan Rincian Wilayah Lengkap (Provinsi, Kota, Kecamatan, Kelurahan)'}
                  </button>

                  {showDetailedAddress && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 text-xs">
                      <div>
                        <label className="block text-slate-500 mb-1">
                          Nama Jalan / Detail
                        </label>
                        <input
                          type="text"
                          value={orderForm.street}
                          onChange={(e) =>
                            updateFormField('street', e.target.value)
                          }
                          placeholder="Jalan..."
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">
                          Kelurahan / Desa
                        </label>
                        <input
                          type="text"
                          value={orderForm.kelurahan}
                          onChange={(e) =>
                            updateFormField('kelurahan', e.target.value)
                          }
                          placeholder="Kelurahan..."
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">
                          Kecamatan
                        </label>
                        <input
                          type="text"
                          value={orderForm.kecamatan}
                          onChange={(e) =>
                            updateFormField('kecamatan', e.target.value)
                          }
                          placeholder="Kecamatan..."
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">
                          Kabupaten / Kota
                        </label>
                        <input
                          type="text"
                          value={orderForm.kota}
                          onChange={(e) =>
                            updateFormField('kota', e.target.value)
                          }
                          placeholder="Kabupaten / Kota..."
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-slate-500 mb-1">
                          Provinsi
                        </label>
                        <input
                          type="text"
                          value={orderForm.provinsi}
                          onChange={(e) =>
                            updateFormField('provinsi', e.target.value)
                          }
                          placeholder="Provinsi..."
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Option to save as customer address */}
                {orderForm.partnerId &&
                  !orderForm.selectedCustomerAddressId && (
                    <div className="space-y-2 pt-1 border-t border-slate-100">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={orderForm.saveToCustomerAddresses}
                          onChange={(e) =>
                            updateFormField(
                              'saveToCustomerAddresses',
                              e.target.checked
                            )
                          }
                          className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span>
                          Simpan alamat ini ke buku alamat customer untuk
                          order berikutnya
                        </span>
                      </label>

                      {orderForm.saveToCustomerAddresses && (
                        <div className="pl-5 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={Boolean(orderForm.saveAsDefaultAddress)}
                              onChange={(e) =>
                                updateFormField(
                                  'saveAsDefaultAddress',
                                  e.target.checked
                                )
                              }
                              className="h-3 w-3 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span>Jadikan alamat utama (default)</span>
                          </label>

                          <div className="flex items-center gap-1.5">
                            <label className="text-slate-500">Label:</label>
                            <input
                              type="text"
                              value={orderForm.addressName || ''}
                              onChange={(e) =>
                                updateFormField('addressName', e.target.value)
                              }
                              placeholder="Rumah, Kantor, dll"
                              className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs w-36 bg-white text-slate-800"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
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

              {/* Card 5: Deposit & Catatan Tambahan */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 sm:p-6 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 tracking-tight">
                      Deposit & Catatan Tambahan
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Uang jaminan sewa (opsional) dan catatan khusus untuk kurir
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={orderForm.requiresDeposit}
                      onChange={(e) =>
                        updateFormField('requiresDeposit', e.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-semibold text-slate-800">
                      Memerlukan Deposit / Uang Jaminan
                    </span>
                  </label>

                  {orderForm.requiresDeposit && (
                    <div className="pl-6 pt-1">
                      <Input
                        label="Nominal Deposit / Uang Jaminan"
                        type="number"
                        min={0}
                        value={orderForm.depositAmount}
                        onChange={(e) =>
                          updateFormField('depositAmount', e.target.value)
                        }
                        placeholder="Contoh: 100000"
                        selectOnFocus
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Uang jaminan akan dicatat pada draft dan diverifikasi saat konfirmasi pesanan.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/60">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Keterangan Order
                  </label>
                  <textarea
                    value={orderForm.notes}
                    onChange={(e) => updateFormField('notes', e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-white border-slate-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 shadow-2xs"
                    rows={2}
                    placeholder="Catatan instruksi untuk kurir, patokan antar, atau keterangan pesanan lainnya..."
                  />
                </div>
              </div>

              {/* Visual Stock Conflicts Warning */}
              {stockConflicts && stockConflicts.length > 0 && (
                <div className="rounded-2xl border border-rose-300 bg-rose-50/80 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-rose-900 font-semibold text-sm">
                    <ExclamationTriangleIcon className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>Konflik Stok Inventaris (Kapasitas Gudang Terlampaui)</span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-rose-800 space-y-1">
                    {stockConflicts.map((c, i) => (
                      <li key={i}>{c.message}</li>
                    ))}
                  </ul>
                  <p className="text-2xs text-rose-700 italic">
                    Paket bundle dan kasur/item ekstra mengambil stok unit fisik yang sama di gudang. Sesuaikan jumlah item agar tidak melebihi stok yang tersedia.
                  </p>
                </div>
              )}

              {/* Ringkasan Pesanan (Invoice Preview) */}
              {orderForm.items.length > 0 && rentalDays > 0 && (
                <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden text-sm">
                  {/* Card Header */}
                  <div className="bg-slate-50/80 px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DocumentTextIcon className="w-5 h-5 text-primary-600" />
                      <span className="font-semibold text-slate-800 tracking-tight">
                        Ringkasan Pesanan (Invoice Preview)
                      </span>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/80">
                      Draft Preview
                    </span>
                  </div>

                  <div className="p-5 sm:p-6 space-y-5">
                    {/* Customer & Delivery Destination Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                      <div>
                        <div className="text-slate-400 font-medium uppercase tracking-wider text-[10px] mb-0.5">
                          Pelanggan
                        </div>
                        <div className="font-semibold text-slate-800">
                          {selectedCustomer?.name || 'Belum dipilih'}
                        </div>
                        {selectedCustomer?.phone && (
                          <div className="text-slate-500">
                            {selectedCustomer.phone}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-slate-400 font-medium uppercase tracking-wider text-[10px] mb-0.5">
                          Tujuan Pengiriman
                        </div>
                        <div className="text-slate-700 line-clamp-2">
                          {orderForm.deliveryAddress ||
                            orderForm.street ||
                            'Alamat pengiriman belum diisi'}
                        </div>
                        {orderForm.googleMapsUrl && (
                          <a
                            href={orderForm.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:text-primary-700 hover:underline mt-0.5"
                          >
                            <MapPinIcon className="w-3 h-3" />
                            Buka di Google Maps ↗
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Rental Period Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-primary-50/60 rounded-lg border border-primary-100 text-xs">
                      <div>
                        <span className="text-primary-800 font-medium">Periode Sewa: </span>
                        <span className="text-slate-700">
                          {orderForm.rentalStartDate} ({orderForm.deliveryTime || '07:00'}) s/d{' '}
                          {orderForm.rentalEndDate} ({orderForm.pickupTime || '18:00'})
                        </span>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-primary-800 bg-primary-100/80">
                        {rentalDays} Hari ({getPricingTierLabel(rentalDays)})
                      </span>
                    </div>

                    {/* Itemized Table */}
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                          <tr>
                            <th className="py-2 px-3">Item / Paket</th>
                            <th className="py-2 px-2 text-center w-14">Qty</th>
                            <th className="py-2 px-3 text-right">Tarif / Hari</th>
                            <th className="py-2 px-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {orderForm.items.map((item, i) => {
                            const line = calculateLineTotal(
                              item,
                              rentalItems,
                              rentalBundles,
                              rentalDays
                            );
                            const qty = Number(item.quantity) || 0;
                            return (
                              <tr key={i} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-medium text-slate-800">
                                  {line.name}
                                  {item.pricePerDay ? (
                                    <span className="ml-1 text-[10px] text-amber-600 font-normal">
                                      (harga khusus)
                                    </span>
                                  ) : null}
                                </td>
                                <td className="py-2 px-2 text-center font-semibold text-slate-700">
                                  {qty}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-600">
                                  {formatCurrency(
                                    item.pricePerDay || line.dailyRate
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right font-semibold text-slate-800">
                                  {formatCurrency(line.lineTotal)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Financial Summary */}
                    <div className="space-y-1.5 pt-2 text-xs border-t border-slate-100">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal Sewa ({rentalDays} hari)</span>
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
                      {upstairsTotalFee > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>
                            Layanan Naik Lantai Atas ({orderForm.upstairsMattressCount} kasur)
                          </span>
                          <span className="font-medium text-slate-800">
                            +{formatCurrency(upstairsTotalFee)}
                          </span>
                        </div>
                      )}
                      {fittedSheetTotalFee > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>
                            Layanan Pasang Sprei ({orderForm.fittedSheetCount} kasur)
                          </span>
                          <span className="font-medium text-slate-800">
                            +{formatCurrency(fittedSheetTotalFee)}
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
                      <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                        <span>Total Tagihan</span>
                        <span className="text-primary-700 text-base">
                          {formatCurrency(totalAmount)}
                        </span>
                      </div>
                      {orderForm.requiresDeposit &&
                        Number(orderForm.depositAmount || 0) > 0 && (
                          <div className="flex justify-between text-xs pt-1.5 border-t border-dashed border-slate-200 text-amber-800">
                            <span>Deposit / Uang Jaminan (Terpisah)</span>
                            <span className="font-semibold">
                              {formatCurrency(Number(orderForm.depositAmount))}
                            </span>
                          </div>
                        )}
                    </div>

                    {/* Order Notes Callout (if present) */}
                    {orderForm.notes?.trim() && (
                      <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-600">
                        <span className="font-semibold text-slate-700">Catatan: </span>
                        {orderForm.notes.trim()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sticky Modal Footer */}
              <div className="sticky bottom-0 -mx-5 -mb-5 sm:-mx-7 sm:-mb-7 mt-8 border-t border-slate-200/80 bg-white/95 backdrop-blur-xs px-5 py-4 sm:px-7 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] rounded-b-2xl z-20">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="w-full sm:w-auto text-left">
                    {orderForm.items.length > 0 && rentalDays > 0 ? (
                      <div>
                        <span className="text-xs text-slate-500 font-medium">
                          Total Estimasi (
                            {orderForm.items.reduce(
                              (acc, it) => acc + (Number(it.quantity) || 1),
                              0
                            )}{' '}
                          unit • {rentalDays} hari):
                        </span>
                        <div className="text-lg font-bold text-primary-700 leading-tight">
                          {formatCurrency(totalAmount)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        Tambahkan item & tanggal untuk melihat total
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleCancelClick}
                      className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={
                        isCreating ||
                        orderForm.items.length === 0 ||
                        !orderForm.partnerId ||
                        !orderForm.rentalStartDate ||
                        !orderForm.rentalEndDate ||
                        hasOverallStockError
                      }
                      className="px-6 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                    >
                      {isEditing
                        ? isCreating
                          ? 'Memperbarui...'
                          : 'Perbarui Order Draft'
                        : isCreating
                          ? 'Menyimpan...'
                          : 'Simpan Order Draft'}
                    </button>
                  </div>
                </div>
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

      <MapSelectorModal
        isOpen={isMapSelectorOpen}
        onClose={() => setIsMapSelectorOpen(false)}
        onSelect={(loc) => {
          applyLocationData(loc);
          setShowDetailedAddress(true);
        }}
        initialCoords={
          orderForm.latitude !== null && orderForm.longitude !== null
            ? { lat: orderForm.latitude, lng: orderForm.longitude }
            : null
        }
      />
    </>
  );
}
