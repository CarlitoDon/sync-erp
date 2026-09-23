import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import FormModal from '@/components/ui/FormModal';
import Select from '@/components/ui/Select';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'react-hot-toast';
import {
  CheckIcon,
  CubeIcon,
  BanknotesIcon,
  UserIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  DocumentArrowUpIcon,
  DocumentTextIcon,
  PhotoIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import QuickAddUnitsModal from './QuickAddUnitsModal';
import PhotoLightbox from '../components/PhotoLightbox';
import { useConfirmOrder } from '../hooks';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
  onSuccess: () => void;
}

function getApiBaseUrl(): string {
  const configuredUrl =
    import.meta.env.VITE_SYNC_ERP_API_URL ||
    'http://localhost:3001/api/trpc';

  return configuredUrl.replace(/\/trpc\/?$/, '');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ConfirmOrderModal({
  isOpen,
  onClose,
  orderId,
  onSuccess,
}: Props) {
  const { currentCompany } = useCompany();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewLightboxOpen, setPreviewLightboxOpen] = useState(false);
  const [previewLightboxPhotos, setPreviewLightboxPhotos] = useState<string[]>(
    []
  );

  const {
    order,
    isLoading,
    paymentMethods,
    selectedPaymentMethodId,
    handleSelectPaymentMethod,
    selectedPaymentMethod,
    availabilityCheck,
    totalItems,
    breakdown,
    depositInput,
    setDepositInput,
    depositPaymentAccountId,
    setDepositPaymentAccountId,
    cashBankAccounts,
    isPaymentPending,
    canConfirm,
    showQuickAddModal,
    manualMode,
    isConfirming,
    isManualConfirming,
    paymentMethodId,
    paymentAmount,
    setPaymentAmount,
    paymentReference,
    setPaymentReference,
    manualNotes,
    setManualNotes,
    skipStockCheck,
    setSkipStockCheck,
    accountingTreatment,
    handleAccountingTreatmentChange,
    handleConfirm,
    handleManualConfirm,
    handleQuickCreatePaymentMethod,
    handleCloseModal,
    handleOpenQuickAdd,
    handleCloseQuickAdd,
    handleQuickAddSuccess,
    enterManualMode,
    proofFile,
    proofPreviewUrl,
    isUploadingProof,
    proofError,
    attachments,
    isLoadingAttachments,
    handleSelectProofFile,
    handleRemoveProofFile,
    handleUploadProofNow,
    handleDeleteAttachment,
    isDeletingAttachment,
  } = useConfirmOrder({ orderId, isOpen, onSuccess, onClose });

  if (!order && !isLoading) return null;

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSelectProofFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleSelectProofFile(file);
    }
  };

  const handleDownloadAttachment = async (
    attachmentId: string,
    fileName: string
  ) => {
    if (!currentCompany?.id) return;
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/attachments/${attachmentId}/download`,
        {
          credentials: 'include',
          headers: { 'x-company-id': currentCompany.id },
        }
      );
      if (!response.ok) {
        throw new Error(`Gagal mengunduh file (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunduh file');
    }
  };

  const openImagePreview = (imageUrl: string) => {
    setPreviewLightboxPhotos([imageUrl]);
    setPreviewLightboxOpen(true);
  };

  return (
    <>
      <FormModal
        isOpen={isOpen}
        onClose={handleCloseModal}
        title={`Konfirmasi Order - ${order?.orderNumber || '...'}`}
      >
        <div className="space-y-4 max-h-[82vh] overflow-y-auto px-1 pb-1">
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
                    Order ini belum diverifikasi pembayarannya oleh customer.
                    Anda dapat mengonfirmasi setelah menerima dan memverifikasi
                    bukti pembayaran.
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
                          <td className="py-1 text-center">{s.required}</td>
                          <td className="py-1 text-center">{s.available}</td>
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

              {/* Order Info Summary */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-700">
                    <UserIcon className="w-4 h-4 text-gray-500" />
                    <span className="font-semibold">
                      {order?.partner?.name || 'Customer'}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-gray-500 bg-gray-200/70 px-2 py-0.5 rounded">
                    {order?.orderNumber}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <CalendarIcon className="w-4 h-4 text-gray-400" />
                  <span>
                    {order?.rentalStartDate
                      ? new Date(order.rentalStartDate).toLocaleDateString(
                          'id-ID'
                        )
                      : '-'}{' '}
                    s/d{' '}
                    {order?.rentalEndDate
                      ? new Date(order.rentalEndDate).toLocaleDateString(
                          'id-ID'
                        )
                      : '-'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <CubeIcon className="w-4 h-4 text-gray-400" />
                  <span>{totalItems} item disewa</span>
                </div>
              </div>

              {/* Order Items List */}
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
                {order?.items?.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 flex justify-between items-center text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-800">
                        {item.rentalBundle?.name ||
                          item.rentalItem?.product?.name ||
                          'Item'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.quantity} unit × Rp{' '}
                        {Number(item.unitPrice).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <p className="font-medium text-slate-700">
                      Rp {Number(item.subtotal).toLocaleString('id-ID')}
                    </p>
                  </div>
                ))}
              </div>

              {/* Requirement 1: Comprehensive Financial Breakdown (Rincian Biaya Transparan & Jelas) */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5 text-sm">
                <div className="font-semibold text-slate-800 pb-2 border-b border-slate-200 flex justify-between items-center">
                  <span>Rincian Biaya &amp; Tagihan</span>
                  <span className="text-xs text-slate-500 font-normal">
                    Faktur Order
                  </span>
                </div>

                {/* Subtotal Sewa */}
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Sewa</span>
                  <span className="font-medium text-slate-800">
                    Rp {breakdown.subtotal.toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Ongkos Kirim (Ongkir) */}
                {breakdown.baseDeliveryFee > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Ongkos Kirim (Ongkir)</span>
                    <span className="font-medium text-slate-800">
                      +Rp {breakdown.baseDeliveryFee.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}

                {/* Layanan Naik Lantai Atas */}
                {breakdown.upstairsTotalFee > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>
                      Layanan Naik Lantai Atas ({breakdown.upstairsCount} kasur)
                    </span>
                    <span className="font-medium text-slate-800">
                      +Rp {breakdown.upstairsTotalFee.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}

                {/* Layanan Pasang Sprei */}
                {breakdown.fittedSheetTotalFee > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>
                      Layanan Pasang Sprei ({breakdown.fittedSheetCount} kasur)
                    </span>
                    <span className="font-medium text-slate-800">
                      +Rp {breakdown.fittedSheetTotalFee.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}

                {/* Diskon / Potongan Harga */}
                {breakdown.discounts.length > 0 ? (
                  breakdown.discounts.map((d, idx) => (
                    <div
                      key={d.id || idx}
                      className="flex justify-between text-rose-600"
                    >
                      <span className="flex items-center gap-1">
                        <span>{d.label || 'Diskon'}</span>
                        {d.type === 'PERCENTAGE' && d.value ? (
                          <span className="text-[11px] text-rose-400">
                            ({d.value}%)
                          </span>
                        ) : null}
                      </span>
                      <span className="font-medium">
                        -Rp {d.amount.toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))
                ) : breakdown.totalDiscountAmount > 0 ? (
                  <div className="flex justify-between text-rose-600">
                    <span>Diskon</span>
                    <span className="font-medium">
                      -Rp {breakdown.totalDiscountAmount.toLocaleString('id-ID')}
                    </span>
                  </div>
                ) : null}

                {/* Total Tagihan Order */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-bold text-slate-900">
                  <span className="text-base">Total Tagihan Order</span>
                  <span className="text-lg text-primary-600">
                    Rp {breakdown.totalAmount.toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Rincian DP & Sisa Pelunasan */}
                <div className="pt-2 border-t border-dashed border-slate-200 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Uang Muka (DP) yang dibayar:</span>
                    <span className="font-semibold text-blue-700">
                      Rp {breakdown.depositAmount.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Sisa Tagihan Pelunasan:</span>
                    <span
                      className={`font-semibold ${
                        breakdown.remainingBalance === 0
                          ? 'text-green-700'
                          : 'text-amber-700'
                      }`}
                    >
                      Rp {breakdown.remainingBalance.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="pt-1">
                    {breakdown.isFullyPaid ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded font-medium">
                        ✓ Lunas (100% Pembayaran di Muka)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        Sisa tagihan dilunasi saat pengantaran / pengambilan unit
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Requirement 2 & User Instruction: Down Payment, Single Dropdown & Proof Upload */}
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-blue-900 flex items-center gap-1.5">
                    <BanknotesIcon className="w-5 h-5 text-blue-700" />
                    Pembayaran Uang Muka (DP)
                  </h4>
                  <span className="text-xs text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full font-medium">
                    Saran DP ±30%: Rp{' '}
                    {(
                      Math.round(
                        (Number(order?.totalAmount ?? 0) * 0.3) / 1000
                      ) * 1000
                    ).toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CurrencyInput
                    label="Nominal DP"
                    value={depositInput}
                    onChange={setDepositInput}
                    min={0}
                    max={Number(order?.totalAmount ?? 0)}
                    required
                  />

                  {/* Single Unified Dropdown for Sales: Auto-mapped to GL Account */}
                  <Select
                    label="Metode Pembayaran DP"
                    value={selectedPaymentMethodId}
                    onChange={handleSelectPaymentMethod}
                    placeholder="Pilih metode pembayaran"
                    required
                    options={paymentMethods.map((pm) => ({
                      value: pm.id,
                      label: `${pm.name}${
                        pm.account
                          ? ` (${pm.account.code} — ${pm.account.name})`
                          : ' (Belum ada Akun GL)'
                      }`,
                    }))}
                    onCreate={handleQuickCreatePaymentMethod}
                    createLabel="Tambah metode pembayaran"
                  />
                </div>

                {selectedPaymentMethod && !selectedPaymentMethod.accountId && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
                    ⚠️ Metode &quot;{selectedPaymentMethod.name}&quot; belum
                    terhubung ke Akun GL Kas/Bank. Jurnal kas tidak akan
                    diposting otomatis. Anda dapat menghubungkannya di menu{' '}
                    <a
                      href="/settings/payment-methods"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-semibold hover:text-amber-900"
                    >
                      Pengaturan &gt; Metode Pembayaran
                    </a>
                    .
                  </p>
                )}

                <Input
                  label="Referensi Pembayaran"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="No. transfer / kode transaksi / bukti bayar (opsional)"
                />

                {/* Upload Bukti Bayar Down Payment Section */}
                <div className="pt-2 border-t border-blue-200/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-blue-900">
                      Bukti Transfer / Pembayaran DP
                    </label>
                    <span className="text-[11px] text-blue-600">
                      (Gambar JPG/PNG atau PDF, maks. 10MB)
                    </span>
                  </div>

                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                  />

                  {/* Dropzone & Selector */}
                  {!proofFile && (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                        isDragOver
                          ? 'border-blue-500 bg-blue-100/50'
                          : 'border-blue-200 bg-white/60 hover:bg-white hover:border-blue-300'
                      }`}
                    >
                      <DocumentArrowUpIcon className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                      <p className="text-xs text-blue-900 font-medium">
                        Klik untuk memilih file atau seret file ke sini
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Mendukung foto slip transfer, struk bank, screenshot
                        QRIS, atau PDF
                      </p>
                    </div>
                  )}

                  {/* Selected File Preview Card */}
                  {proofFile && (
                    <div className="bg-white border border-blue-200 rounded-lg p-3 flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        {proofPreviewUrl ? (
                          <img
                            src={proofPreviewUrl}
                            alt="Preview Bukti Bayar"
                            onClick={() => openImagePreview(proofPreviewUrl)}
                            className="w-12 h-12 rounded object-cover border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                            title="Klik untuk memperbesar gambar"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <DocumentTextIcon className="w-6 h-6" />
                          </div>
                        )}
                        <div className="min-w-0 text-left">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {proofFile.name}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {formatFileSize(proofFile.size)} •{' '}
                            <span className="text-blue-600 font-medium">
                              Siap diunggah saat konfirmasi
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleUploadProofNow}
                          disabled={isUploadingProof}
                          isLoading={isUploadingProof}
                          className="text-xs h-8 px-2.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                        >
                          Unggah Sekarang
                        </Button>
                        <button
                          type="button"
                          onClick={handleRemoveProofFile}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                          title="Hapus file terpilih"
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {proofError && (
                    <p className="text-xs text-red-600">{proofError}</p>
                  )}

                  {/* Existing Attachments Display */}
                  {isLoadingAttachments && (
                    <p className="text-xs text-gray-400 italic">
                      Memeriksa lampiran tersimpan...
                    </p>
                  )}

                  {attachments.length > 0 && (
                    <div className="pt-2 space-y-1.5">
                      <p className="text-xs font-medium text-gray-700">
                        Bukti Pembayaran Terlampir ({attachments.length}):
                      </p>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {attachments.map((att) => {
                          const isImage =
                            att.mimeType?.startsWith('image/') ||
                            att.originalFileName.match(/\.(jpg|jpeg|png|webp)$/i);
                          return (
                            <div
                              key={att.id}
                              className="bg-white/80 border border-slate-200 rounded p-2 flex items-center justify-between text-xs"
                            >
                              <div
                                className={`flex items-center gap-2 min-w-0 ${
                                  isImage ? 'cursor-pointer hover:text-blue-700' : ''
                                }`}
                                onClick={() => {
                                  if (isImage) {
                                    openImagePreview(
                                      `${getApiBaseUrl()}/attachments/${att.id}/download`
                                    );
                                  }
                                }}
                                title={isImage ? 'Klik untuk melihat preview gambar' : undefined}
                              >
                                {isImage ? (
                                  <PhotoIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                                ) : (
                                  <DocumentTextIcon className="w-4 h-4 text-blue-600 shrink-0" />
                                )}
                                <div className="truncate">
                                  <span className="font-medium text-gray-800">
                                    {att.originalFileName}
                                  </span>
                                  <span className="text-[10px] text-gray-400 ml-1.5">
                                    ({formatFileSize(att.sizeBytes)})
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDownloadAttachment(
                                      att.id,
                                      att.originalFileName
                                    )
                                  }
                                  className="text-primary-600 hover:text-primary-800 p-1 rounded hover:bg-slate-100"
                                  title="Unduh / Lihat lampiran"
                                >
                                  <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttachment(att.id)}
                                  disabled={isDeletingAttachment}
                                  className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                                  title="Hapus lampiran"
                                >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
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
                    <li>Mencatat bukti pembayaran &amp; posting jurnal kas DP</li>
                  </ul>
                </div>
              )}

              {/* Manual Override Section */}
              {!canConfirm && !manualMode && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                  <p className="text-sm text-amber-800 mb-2">
                    Order ini tidak bisa dikonfirmasi otomatis. Gunakan
                    konfirmasi manual jika pembayaran sudah diterima.
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
                    Konfirmasi Manual (Admin Override)
                  </h4>

                  {/* Single Dropdown by default */}
                  <Select
                    label="Metode Pembayaran"
                    value={selectedPaymentMethodId}
                    onChange={handleSelectPaymentMethod}
                    placeholder="Pilih metode pembayaran"
                    required
                    options={paymentMethods.map((pm) => ({
                      value: pm.id,
                      label: `${pm.name}${
                        pm.account
                          ? ` (${pm.account.code} — ${pm.account.name})`
                          : ' (Belum ada Akun GL)'
                      }`,
                    }))}
                    onCreate={handleQuickCreatePaymentMethod}
                    createLabel="Tambah metode pembayaran"
                  />

                  {/* Optional GL Account Override for Admin */}
                  <details className="text-xs text-slate-500">
                    <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-800">
                      Opsi Lanjutan: Sesuaikan Akun Kas/Bank GL (Override)
                    </summary>
                    <div className="pt-2">
                      <Select
                        label="Akun Kas/Bank GL"
                        value={depositPaymentAccountId ?? ''}
                        onChange={(value) =>
                          setDepositPaymentAccountId(value || undefined)
                        }
                        options={cashBankAccounts.map((account) => ({
                          value: account.id,
                          label: `${account.code} — ${account.name}`,
                        }))}
                        placeholder="Pilih akun penerimaan"
                      />
                    </div>
                  </details>

                  <CurrencyInput
                    label="Jumlah Pembayaran (Legacy)"
                    value={paymentAmount}
                    onChange={setPaymentAmount}
                    min={0}
                  />

                  <Select
                    label="Perlakuan Akuntansi"
                    value={accountingTreatment}
                    onChange={handleAccountingTreatmentChange}
                    options={[
                      {
                        value: 'POST_CASH_JOURNAL',
                        label: 'Posting jurnal kas (pembayaran baru)',
                      },
                      {
                        value: 'OPENING_BALANCE_NO_POSTING',
                        label: 'Saldo awal tanpa posting jurnal',
                      },
                    ]}
                  />
                  {accountingTreatment === 'OPENING_BALANCE_NO_POSTING' && (
                    <p className="text-xs text-amber-700">
                      Gunakan hanya untuk migrasi saldo historis. Tidak ada
                      jurnal kas baru yang akan dibuat.
                    </p>
                  )}

                  {!availabilityCheck.isAvailable && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="skipStock"
                        checked={skipStockCheck}
                        onChange={(e) => setSkipStockCheck(e.target.checked)}
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
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <Button variant="outline" onClick={handleCloseModal}>
                  Tutup
                </Button>
                {manualMode ? (
                  <Button
                    onClick={handleManualConfirm}
                    disabled={
                      (!selectedPaymentMethodId && !paymentMethodId) ||
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
                    disabled={
                      !canConfirm ||
                      isConfirming ||
                      (depositInput > 0 && !selectedPaymentMethodId)
                    }
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

      {/* Photo Lightbox for Preview */}
      <PhotoLightbox
        isOpen={previewLightboxOpen}
        photos={previewLightboxPhotos}
        onClose={() => setPreviewLightboxOpen(false)}
      />
    </>
  );
}
