import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useConfirmOrder } from '@/features/rental/hooks/useConfirmOrder';

const mockGetById = vi.fn();
const mockItemsList = vi.fn();
const mockPaymentMethodList = vi.fn();
const mockAttachmentList = vi.fn();
const mockConfirmMutateAsync = vi.fn();
const mockManualConfirmMutateAsync = vi.fn();
const mockUploadMutateAsync = vi.fn();
const mockDeleteMutateAsync = vi.fn();
const mockCreatePaymentMethodMutateAsync = vi.fn();
const mockInvalidate = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      rental: {
        orders: {
          list: { invalidate: mockInvalidate },
          getById: { invalidate: mockInvalidate },
        },
        items: {
          list: { invalidate: mockInvalidate },
        },
      },
      paymentMethod: {
        list: { invalidate: mockInvalidate },
      },
      attachment: {
        list: { invalidate: mockInvalidate },
      },
    }),
    rental: {
      orders: {
        getById: {
          useQuery: (...args: unknown[]) => mockGetById(...args),
        },
        confirm: {
          useMutation: (opts?: { onSuccess?: () => void }) => ({
            mutateAsync: (...args: unknown[]) => {
              const res = mockConfirmMutateAsync(...args);
              opts?.onSuccess?.();
              return res;
            },
            isPending: false,
          }),
        },
        manualConfirm: {
          useMutation: (opts?: { onSuccess?: () => void }) => ({
            mutateAsync: (...args: unknown[]) => {
              const res = mockManualConfirmMutateAsync(...args);
              opts?.onSuccess?.();
              return res;
            },
            isPending: false,
          }),
        },
      },
      items: {
        list: {
          useQuery: (...args: unknown[]) => mockItemsList(...args),
        },
      },
    },
    paymentMethod: {
      list: {
        useQuery: (...args: unknown[]) => mockPaymentMethodList(...args),
      },
      create: {
        useMutation: (opts?: { onSuccess?: (data: unknown) => void }) => ({
          mutateAsync: async (...args: unknown[]) => {
            const res = await mockCreatePaymentMethodMutateAsync(...args);
            opts?.onSuccess?.(res);
            return res;
          },
          isPending: false,
        }),
      },
    },
    attachment: {
      list: {
        useQuery: (...args: unknown[]) => mockAttachmentList(...args),
      },
      upload: {
        useMutation: (opts?: { onSuccess?: () => void }) => ({
          mutateAsync: async (...args: unknown[]) => {
            const res = await mockUploadMutateAsync(...args);
            opts?.onSuccess?.();
            return res;
          },
          isPending: false,
        }),
      },
      delete: {
        useMutation: (opts?: { onSuccess?: () => void }) => ({
          mutateAsync: async (...args: unknown[]) => {
            const res = await mockDeleteMutateAsync(...args);
            opts?.onSuccess?.();
            return res;
          },
          isPending: false,
        }),
      },
    },
  },
}));

vi.mock('@/hooks/useCashBankAccounts', () => ({
  useCashBankAccounts: () => ({
    cashBankAccounts: [
      { id: 'acc-1', code: '1001', name: 'Kas Dompet Hitam' },
      { id: 'acc-2', code: '1055', name: 'Bank Jago Mila' },
    ],
    isLoading: false,
  }),
}));

describe('useConfirmOrder Hook', () => {
  const validOrderId = '11111111-1111-4111-8111-111111111111';
  const validAcc1 = '22222222-2222-4222-8222-222222222222';
  const validAcc2 = '33333333-3333-4333-8333-333333333333';
  const validPmQris = '44444444-4444-4444-8444-444444444444';
  const validPmCash = '55555555-5555-4555-8555-555555555555';

  const sampleOrder = {
    id: validOrderId,
    orderNumber: 'RNT-101',
    orderSource: 'ADMIN',
    rentalPaymentStatus: 'PENDING',
    subtotal: 70000,
    deliveryFee: 17500,
    totalAmount: 87500,
    depositAmount: 0,
    paymentMethod: 'qris',
    paymentReference: 'REF-CUSTOMER-1',
    notes: 'Kasur naik lantai atas: 1 unit\nKasur dipasang sprei: 1 unit',
    partner: { name: 'Customer A' },
    items: [
      {
        id: 'oi-1',
        rentalItemId: 'ri-1',
        quantity: 1,
        unitPrice: 70000,
        subtotal: 70000,
      },
    ],
  };

  const samplePaymentMethods = [
    {
      id: validPmQris,
      code: 'QRIS',
      name: 'QRIS BCA',
      type: 'QRIS',
      accountId: validAcc2,
      account: { id: validAcc2, code: '1055', name: 'Bank Jago Mila' },
      isDefault: false,
    },
    {
      id: validPmCash,
      code: 'CASH',
      name: 'Tunai',
      type: 'CASH',
      accountId: validAcc1,
      account: { id: validAcc1, code: '1001', name: 'Kas Dompet Hitam' },
      isDefault: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetById.mockReturnValue({ data: sampleOrder, isLoading: false });
    mockItemsList.mockReturnValue({
      data: [
        {
          id: 'ri-1',
          units: [{ id: 'u-1', status: 'AVAILABLE' }],
          product: { name: 'Kasur Single' },
        },
      ],
      isLoading: false,
    });
    mockPaymentMethodList.mockReturnValue({
      data: samplePaymentMethods,
      isLoading: false,
    });
    mockAttachmentList.mockReturnValue({ data: [], isLoading: false });
  });

  it('auto-selects matching payment method and maps accountId correctly', () => {
    const { result } = renderHook(() =>
      useConfirmOrder({
        orderId: validOrderId,
        isOpen: true,
        onSuccess: vi.fn(),
        onClose: vi.fn(),
      })
    );

    // Because order.paymentMethod is 'qris', it auto-selects validPmQris
    expect(result.current.selectedPaymentMethodId).toBe(validPmQris);
    expect(result.current.depositPaymentMethod).toBe('QRIS');
    expect(result.current.depositPaymentAccountId).toBe(validAcc2);
    expect(result.current.paymentReference).toBe('REF-CUSTOMER-1');
  });

  it('updates depositPaymentMethod and depositPaymentAccountId when sales changes the dropdown', () => {
    const { result } = renderHook(() =>
      useConfirmOrder({
        orderId: validOrderId,
        isOpen: true,
        onSuccess: vi.fn(),
        onClose: vi.fn(),
      })
    );

    act(() => {
      result.current.handleSelectPaymentMethod(validPmCash);
    });

    expect(result.current.selectedPaymentMethodId).toBe(validPmCash);
    expect(result.current.depositPaymentMethod).toBe('CASH');
    expect(result.current.depositPaymentAccountId).toBe(validAcc1);
  });

  it('calculates suggested deposit and transparent financial breakdown', () => {
    const { result } = renderHook(() =>
      useConfirmOrder({
        orderId: validOrderId,
        isOpen: true,
        onSuccess: vi.fn(),
        onClose: vi.fn(),
      })
    );

    // 87500 * 0.3 = 26250 -> rounded to nearest 1000 = 26000
    expect(result.current.depositInput).toBe(26000);

    // Check financial breakdown
    expect(result.current.breakdown.subtotal).toBe(70000);
    expect(result.current.breakdown.baseDeliveryFee).toBe(12000);
    expect(result.current.breakdown.upstairsTotalFee).toBe(3500);
    expect(result.current.breakdown.fittedSheetTotalFee).toBe(2000);
    expect(result.current.breakdown.totalAmount).toBe(87500);
    expect(result.current.breakdown.remainingBalance).toBe(87500 - 26000);
  });

  it('attaches proof of payment file and uploads during handleConfirm', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useConfirmOrder({
        orderId: validOrderId,
        isOpen: true,
        onSuccess,
        onClose,
      })
    );

    const file = new File(['mock-slip'], 'transfer_slip.jpg', {
      type: 'image/jpeg',
    });

    act(() => {
      result.current.handleSelectProofFile(file);
    });

    expect(result.current.proofFile).toBe(file);
    expect(result.current.proofPreviewUrl).toBeTruthy();

    await act(async () => {
      await result.current.handleConfirm();
    });

    // Verification of upload attachment mutation
    expect(mockUploadMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'RENTAL_ORDER',
        entityId: validOrderId,
        fileName: 'transfer_slip.jpg',
      })
    );

    // Verification of confirm mutation
    expect(mockConfirmMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: validOrderId,
        depositAmount: 26000,
        paymentMethod: 'QRIS',
        paymentAccountId: validAcc2,
        paymentMethodId: validPmQris,
      })
    );

    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('rejects empty 0-byte file when selecting proof of payment', () => {
    const { result } = renderHook(() =>
      useConfirmOrder({
        orderId: validOrderId,
        isOpen: true,
        onSuccess: vi.fn(),
        onClose: vi.fn(),
      })
    );

    const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });
    act(() => {
      result.current.handleSelectProofFile(emptyFile);
    });

    expect(result.current.proofFile).toBeNull();
    expect(result.current.proofError).toBe('File tidak boleh kosong.');
  });

  it('aborts confirm mutation and keeps modal open if upload fails', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    mockUploadMutateAsync.mockRejectedValueOnce(new Error('S3 Storage Timeout'));

    const { result } = renderHook(() =>
      useConfirmOrder({
        orderId: validOrderId,
        isOpen: true,
        onSuccess,
        onClose,
      })
    );

    const file = new File(['valid-bytes'], 'slip.png', { type: 'image/png' });
    act(() => {
      result.current.handleSelectProofFile(file);
    });

    await act(async () => {
      await result.current.handleConfirm();
    });

    // Attachment upload failed, confirm mutation should NOT be called
    expect(mockConfirmMutateAsync).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not proceed with confirmation if depositInput > 0 but no payment method selected', async () => {
    const { result } = renderHook(() =>
      useConfirmOrder({
        orderId: validOrderId,
        isOpen: true,
        onSuccess: vi.fn(),
        onClose: vi.fn(),
      })
    );

    act(() => {
      result.current.handleSelectPaymentMethod('');
    });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(mockConfirmMutateAsync).not.toHaveBeenCalled();
  });
});
