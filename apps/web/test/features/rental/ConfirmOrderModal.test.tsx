import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ConfirmOrderModal from '@/features/rental/modals/ConfirmOrderModal';

const mockUseConfirmOrder = vi.fn();
const mockUseCompany = vi.fn();

vi.mock('@/features/rental/hooks', () => ({
  useConfirmOrder: (...args: unknown[]) => mockUseConfirmOrder(...args),
}));

vi.mock('@/features/rental/modals/QuickAddUnitsModal', () => ({
  default: () => null,
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => mockUseCompany(),
}));

describe('ConfirmOrderModal Component', () => {
  const defaultBreakdown = {
    subtotal: 70000,
    baseDeliveryFee: 12000,
    upstairsCount: 1,
    upstairsFeePerUnit: 3500,
    upstairsTotalFee: 3500,
    fittedSheetCount: 1,
    fittedSheetFeePerUnit: 2000,
    fittedSheetTotalFee: 2000,
    discounts: [],
    totalDiscountAmount: 0,
    totalAmount: 87500,
    depositAmount: 26000,
    remainingBalance: 61500,
    isFullyPaid: false,
  };

  const defaultHookData = {
    order: {
      id: 'order-1',
      orderNumber: 'RNT-202609-001',
      partner: { name: 'Budi Santoso' },
      rentalStartDate: '2026-09-24T00:00:00.000Z',
      rentalEndDate: '2026-09-26T00:00:00.000Z',
      totalAmount: 87500,
      subtotal: 70000,
      depositAmount: 26000,
      items: [
        {
          id: 'item-1',
          quantity: 1,
          unitPrice: 70000,
          subtotal: 70000,
          rentalItem: { product: { name: 'Kasur Busa Single 90x200' } },
        },
      ],
    },
    isLoading: false,
    paymentMethods: [
      {
        id: 'pm-qris',
        name: 'QRIS',
        code: 'QRIS',
        type: 'QRIS',
        accountId: 'acc-1055',
        account: { id: 'acc-1055', code: '1055', name: 'Bank Jago Mila' },
      },
      {
        id: 'pm-bca',
        name: 'Transfer Bank BCA',
        code: 'BCA_TRANSFER',
        type: 'BANK',
        accountId: 'acc-1056',
        account: { id: 'acc-1056', code: '1056', name: 'Bank BCA Mila' },
      },
    ],
    selectedPaymentMethodId: 'pm-qris',
    handleSelectPaymentMethod: vi.fn(),
    selectedPaymentMethod: {
      id: 'pm-qris',
      name: 'QRIS',
      accountId: 'acc-1055',
    },
    availabilityCheck: { isAvailable: true, shortages: [] },
    totalItems: 1,
    depositAmount: 26000,
    breakdown: defaultBreakdown,
    depositInput: 26000,
    setDepositInput: vi.fn(),
    depositPaymentAccountId: 'acc-1055',
    setDepositPaymentAccountId: vi.fn(),
    cashBankAccounts: [],
    isPaymentPending: false,
    canConfirm: true,
    showQuickAddModal: false,
    manualMode: false,
    isConfirming: false,
    isManualConfirming: false,
    paymentMethodId: 'pm-qris',
    paymentAmount: 26000,
    setPaymentAmount: vi.fn(),
    paymentReference: 'INV-TRF-01',
    setPaymentReference: vi.fn(),
    manualNotes: '',
    setManualNotes: vi.fn(),
    skipStockCheck: false,
    setSkipStockCheck: vi.fn(),
    accountingTreatment: 'POST_CASH_JOURNAL',
    handleAccountingTreatmentChange: vi.fn(),
    handleConfirm: vi.fn(),
    handleManualConfirm: vi.fn(),
    handleQuickCreatePaymentMethod: vi.fn(),
    handleCloseModal: vi.fn(),
    handleOpenQuickAdd: vi.fn(),
    handleCloseQuickAdd: vi.fn(),
    handleQuickAddSuccess: vi.fn(),
    enterManualMode: vi.fn(),
    proofFile: null,
    proofPreviewUrl: null,
    isUploadingProof: false,
    proofError: null,
    attachments: [],
    isLoadingAttachments: false,
    handleSelectProofFile: vi.fn(),
    handleRemoveProofFile: vi.fn(),
    handleUploadProofNow: vi.fn(),
    handleDeleteAttachment: vi.fn(),
    isDeletingAttachment: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCompany.mockReturnValue({
      currentCompany: { id: 'comp-1', name: 'Santi Living' },
    });
    mockUseConfirmOrder.mockReturnValue(defaultHookData);
  });

  it('renders complete financial breakdown matching requirements', () => {
    render(
      <ConfirmOrderModal
        isOpen={true}
        onClose={vi.fn()}
        orderId="order-1"
        onSuccess={vi.fn()}
      />
    );

    // Verify Customer and Order Number
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('RNT-202609-001')).toBeInTheDocument();

    // Verify Subtotal Sewa
    expect(screen.getByText('Subtotal Sewa')).toBeInTheDocument();
    expect(screen.getAllByText('Rp 70.000')).toHaveLength(2);

    // Verify Ongkos Kirim (Ongkir)
    expect(screen.getByText('Ongkos Kirim (Ongkir)')).toBeInTheDocument();
    expect(screen.getByText('+Rp 12.000')).toBeInTheDocument();

    // Verify Layanan Naik Lantai Atas
    expect(
      screen.getByText('Layanan Naik Lantai Atas (1 kasur)')
    ).toBeInTheDocument();
    expect(screen.getByText('+Rp 3.500')).toBeInTheDocument();

    // Verify Layanan Pasang Sprei
    expect(
      screen.getByText('Layanan Pasang Sprei (1 kasur)')
    ).toBeInTheDocument();
    expect(screen.getByText('+Rp 2.000')).toBeInTheDocument();

    // Verify Total Tagihan Order
    expect(screen.getByText('Total Tagihan Order')).toBeInTheDocument();
    expect(screen.getAllByText('Rp 87.500').length).toBeGreaterThanOrEqual(1);

    // Verify DP & Sisa Pelunasan
    expect(screen.getByText('Uang Muka (DP) yang dibayar:')).toBeInTheDocument();
    expect(screen.getAllByText('Rp 26.000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Sisa Tagihan Pelunasan:')).toBeInTheDocument();
    expect(screen.getByText('Rp 61.500')).toBeInTheDocument();
  });

  it('renders single payment method dropdown with GL account mapping for sales', () => {
    render(
      <ConfirmOrderModal
        isOpen={true}
        onClose={vi.fn()}
        orderId="order-1"
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('Metode Pembayaran DP')).toBeInTheDocument();
    expect(
      screen.getByText('QRIS (1055 — Bank Jago Mila)')
    ).toBeInTheDocument();
  });

  it('renders proof of payment upload section and dropzone', () => {
    render(
      <ConfirmOrderModal
        isOpen={true}
        onClose={vi.fn()}
        orderId="order-1"
        onSuccess={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Bukti Transfer \/ Pembayaran/)
    ).toBeInTheDocument();
    expect(
      screen.getByText('Klik untuk memilih file atau seret file ke sini')
    ).toBeInTheDocument();
  });

  it('displays selected proof file preview card and remove button', () => {
    const file = new File(['proof-data'], 'slip_transfer_bca.jpg', {
      type: 'image/jpeg',
    });

    mockUseConfirmOrder.mockReturnValue({
      ...defaultHookData,
      proofFile: file,
      proofPreviewUrl: 'blob:http://localhost/mock-preview-url',
    });

    render(
      <ConfirmOrderModal
        isOpen={true}
        onClose={vi.fn()}
        orderId="order-1"
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('slip_transfer_bca.jpg')).toBeInTheDocument();
    expect(
      screen.getByText(/Siap diunggah saat konfirmasi/i)
    ).toBeInTheDocument();
    expect(screen.getByTitle('Hapus file terpilih')).toBeInTheDocument();
  });

  it('displays existing uploaded attachments', () => {
    mockUseConfirmOrder.mockReturnValue({
      ...defaultHookData,
      attachments: [
        {
          id: 'att-1',
          originalFileName: 'struk_pembayaran_dp.pdf',
          sizeBytes: 154200,
          mimeType: 'application/pdf',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    render(
      <ConfirmOrderModal
        isOpen={true}
        onClose={vi.fn()}
        orderId="order-1"
        onSuccess={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Bukti Pembayaran Terlampir \(1\):/)
    ).toBeInTheDocument();
    expect(screen.getByText('struk_pembayaran_dp.pdf')).toBeInTheDocument();
    expect(screen.getByTitle('Unduh / Lihat lampiran')).toBeInTheDocument();
    expect(screen.getByTitle('Hapus lampiran')).toBeInTheDocument();
  });

  it('triggers confirmation when Konfirmasi Order button is clicked', () => {
    const handleConfirmMock = vi.fn();
    mockUseConfirmOrder.mockReturnValue({
      ...defaultHookData,
      handleConfirm: handleConfirmMock,
    });

    render(
      <ConfirmOrderModal
        isOpen={true}
        onClose={vi.fn()}
        orderId="order-1"
        onSuccess={vi.fn()}
      />
    );

    const confirmButton = screen.getByRole('button', {
      name: /Konfirmasi Order/i,
    });
    fireEvent.click(confirmButton);
    expect(handleConfirmMock).toHaveBeenCalledTimes(1);
  });
});
