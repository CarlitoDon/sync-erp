import { useState, useMemo, useCallback, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';
import { useCashBankAccounts } from '@/hooks/useCashBankAccounts';
import {
  ManualConfirmAccountingTreatment,
  OrderSource,
  RentalPaymentStatus,
  PaymentMethodTypeSchema,
  ConfirmRentalOrderSchema,
  ManualConfirmRentalOrderSchema,
  RentalPaymentMethodSchema,
  type RentalPaymentMethod,
} from '@sync-erp/shared';
import { toast } from 'react-hot-toast';
import {
  calculateRentalOrderBreakdown,
  type RentalOrderFinancialBreakdown,
} from '../utils/rentalOrderBreakdown';

interface Shortage {
  rentalItemId: string;
  productName: string;
  productSku: string;
  required: number;
  available: number;
  shortage: number;
}

interface UseConfirmOrderParams {
  orderId: string | null;
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Gagal membaca file'));
        return;
      }
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Format file tidak valid'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
}

export function useConfirmOrder({
  orderId,
  isOpen,
  onSuccess,
  onClose,
}: UseConfirmOrderParams) {
  const utils = trpc.useUtils();
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);

  // Manual override state
  const [manualMode, setManualMode] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [depositInput, setDepositInput] = useState(0);
  const [depositPaymentMethod, setDepositPaymentMethod] =
    useState<RentalPaymentMethod>(RentalPaymentMethodSchema.enum.BANK);
  const [depositPaymentAccountId, setDepositPaymentAccountId] = useState<
    string | undefined
  >();
  const [paymentReference, setPaymentReference] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [skipStockCheck, setSkipStockCheck] = useState(false);
  const [accountingTreatment, setAccountingTreatment] =
    useState<ManualConfirmAccountingTreatment>('POST_CASH_JOURNAL');

  // Proof of payment file upload state
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  const handleRemoveProofFile = useCallback(() => {
    setProofFile(null);
    if (proofPreviewUrl) {
      URL.revokeObjectURL(proofPreviewUrl);
      setProofPreviewUrl(null);
    }
    setProofError(null);
  }, [proofPreviewUrl]);

  const resetManualConfirmForm = useCallback(() => {
    setManualMode(false);
    setSelectedPaymentMethodId('');
    setPaymentMethodId('');
    setPaymentAmount(0);
    setDepositInput(0);
    setDepositPaymentMethod(RentalPaymentMethodSchema.enum.BANK);
    setDepositPaymentAccountId(undefined);
    setPaymentReference('');
    setManualNotes('');
    setSkipStockCheck(false);
    setAccountingTreatment('POST_CASH_JOURNAL');
    handleRemoveProofFile();
  }, [handleRemoveProofFile]);

  // Queries
  const { data: order, isLoading } =
    trpc.rental.orders.getById.useQuery(
      { id: orderId! },
      { enabled: isOpen && !!orderId }
    );

  const { data: rentalItems = [] } = trpc.rental.items.list.useQuery(
    undefined,
    { enabled: isOpen }
  );

  const { data: paymentMethods = [] } =
    trpc.paymentMethod.list.useQuery(undefined, { enabled: isOpen });
  const { cashBankAccounts } = useCashBankAccounts({ enabled: isOpen });

  // Attachments query for this order
  const attachmentsQuery = trpc.attachment.list.useQuery(
    {
      entityType: 'RENTAL_ORDER',
      entityId: orderId!,
    },
    { enabled: isOpen && !!orderId }
  );

  const uploadAttachmentMutation = trpc.attachment.upload.useMutation({
    onSuccess: () => {
      if (orderId) {
        utils.attachment.list.invalidate({
          entityType: 'RENTAL_ORDER',
          entityId: orderId,
        });
      }
      setProofFile(null);
      if (proofPreviewUrl) {
        URL.revokeObjectURL(proofPreviewUrl);
        setProofPreviewUrl(null);
      }
      setProofError(null);
    },
    onError: (err) => {
      setProofError(err.message);
      toast.error(`Gagal upload bukti bayar: ${err.message}`);
    },
  });

  const deleteAttachmentMutation = trpc.attachment.delete.useMutation({
    onSuccess: () => {
      if (orderId) {
        utils.attachment.list.invalidate({
          entityType: 'RENTAL_ORDER',
          entityId: orderId,
        });
      }
      toast.success('Bukti bayar dihapus');
    },
    onError: (err) => {
      toast.error(`Gagal menghapus file: ${err.message}`);
    },
  });

  // Calculate suggested deposit (DP ±30% default)
  const suggestedDeposit = order
    ? Number(order.depositAmount) > 0
      ? Number(order.depositAmount)
      : Math.round((Number(order.totalAmount) * 0.3) / 1000) * 1000
    : 0;

  // Single dropdown auto-mapping logic
  const selectedPaymentMethod = useMemo(
    () => paymentMethods.find((m) => m.id === selectedPaymentMethodId),
    [paymentMethods, selectedPaymentMethodId]
  );

  const handleSelectPaymentMethod = useCallback(
    (id: string) => {
      setSelectedPaymentMethodId(id);
      const pm = paymentMethods.find((m) => m.id === id);
      if (pm) {
        const mappedMethod: RentalPaymentMethod =
          pm.type === PaymentMethodTypeSchema.enum.CASH
            ? RentalPaymentMethodSchema.enum.CASH
            : pm.type === PaymentMethodTypeSchema.enum.QRIS
              ? RentalPaymentMethodSchema.enum.QRIS
              : RentalPaymentMethodSchema.enum.BANK;
        setDepositPaymentMethod(mappedMethod);
        setDepositPaymentAccountId(pm.accountId || undefined);
        setPaymentMethodId(pm.id);
      } else {
        setDepositPaymentAccountId(undefined);
        setPaymentMethodId('');
      }
    },
    [paymentMethods]
  );

  // Initialize and synchronize states on modal open
  useEffect(() => {
    if (isOpen && order) {
      setDepositInput(suggestedDeposit);
      setPaymentAmount(suggestedDeposit);
      setPaymentReference(order.paymentReference || '');

      // Auto-select payment method matching order or default
      if (paymentMethods.length > 0 && !selectedPaymentMethodId) {
        let matchedId = '';
        if (order.paymentMethod) {
          const orderMethodLower = order.paymentMethod.toLowerCase();
          const match = paymentMethods.find(
            (m) =>
              m.code.toLowerCase() === orderMethodLower ||
              m.type.toLowerCase() === orderMethodLower ||
              (orderMethodLower === 'transfer' &&
                m.type === PaymentMethodTypeSchema.enum.BANK)
          );
          if (match) {
            matchedId = match.id;
          }
        }
        if (!matchedId) {
          const defaultMethod =
            paymentMethods.find((m) => m.isDefault) || paymentMethods[0];
          if (defaultMethod) {
            matchedId = defaultMethod.id;
          }
        }

        if (matchedId) {
          handleSelectPaymentMethod(matchedId);
        }
      }
    }
    if (!isOpen) {
      setDepositInput(0);
      setPaymentAmount(0);
      setSelectedPaymentMethodId('');
      setDepositPaymentMethod(RentalPaymentMethodSchema.enum.BANK);
      setDepositPaymentAccountId(undefined);
      setPaymentReference('');
      handleRemoveProofFile();
    }
  }, [
    isOpen,
    order?.id,
    order?.depositAmount,
    order?.totalAmount,
    order?.paymentMethod,
    order?.paymentReference,
    suggestedDeposit,
    paymentMethods,
    handleSelectPaymentMethod,
    handleRemoveProofFile,
  ]);

  // Comprehensive financial breakdown calculation
  const breakdown: RentalOrderFinancialBreakdown = useMemo(
    () => calculateRentalOrderBreakdown(order, depositInput),
    [order, depositInput]
  );

  // Availability check
  const availabilityCheck = useMemo(() => {
    if (!order?.items)
      return { shortages: [] as Shortage[], isAvailable: true };

    const shortages: Shortage[] = [];

    order.items.forEach((item) => {
      if (item.rentalBundleId && item.rentalBundle?.components) {
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

  // Payment status
  const paymentStatus = order?.rentalPaymentStatus;
  const isPaymentVerified =
    order?.orderSource === OrderSource.ADMIN
      ? true
      : paymentStatus === RentalPaymentStatus.CONFIRMED;
  const isPaymentPending =
    order?.orderSource !== OrderSource.ADMIN &&
    paymentStatus === RentalPaymentStatus.PENDING;
  const canConfirm =
    isPaymentVerified && availabilityCheck.isAvailable;

  // Mutations
  const confirmMutation = trpc.rental.orders.confirm.useMutation({
    onSuccess: () => {
      utils.rental.orders.list.invalidate();
      utils.rental.orders.getById.invalidate({ id: orderId! });
      onSuccess();
      onClose();
    },
  });

  const manualConfirmMutation =
    trpc.rental.orders.manualConfirm.useMutation({
      onSuccess: () => {
        utils.rental.orders.list.invalidate();
        utils.rental.orders.getById.invalidate({ id: orderId! });
        resetManualConfirmForm();
        onSuccess();
        onClose();
      },
    });

  const createPaymentMethodMutation =
    trpc.paymentMethod.create.useMutation({
      onSuccess: (data) => {
        utils.paymentMethod.list.invalidate();
        setSelectedPaymentMethodId(data.id);
        handleSelectPaymentMethod(data.id);
        toast.success(`Metode "${data.name}" berhasil dibuat!`);
      },
      onError: (error) => {
        toast.error(`Gagal membuat metode: ${error.message}`);
      },
    });

  // Proof of payment file handlers
  const handleSelectProofFile = useCallback((file: File) => {
    const validExtensions = /\.(jpg|jpeg|png|webp|pdf)$/i;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';

    if (!isImage && !isPdf && !validExtensions.test(file.name)) {
      setProofError('File harus berupa gambar (JPG, PNG, WebP) atau PDF.');
      toast.error('File harus berupa gambar (JPG, PNG, WebP) atau PDF.');
      return;
    }

    if (file.size === 0) {
      setProofError('File tidak boleh kosong.');
      toast.error('File tidak boleh kosong.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setProofError('Ukuran file maksimal 10MB.');
      toast.error('Ukuran file maksimal 10MB.');
      return;
    }

    setProofError(null);
    setProofFile(file);
    if (isImage || file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setProofPreviewUrl(url);
    } else {
      setProofPreviewUrl(null);
    }
  }, []);

  const handleUploadProofNow = useCallback(async () => {
    if (!orderId || !proofFile) return;
    try {
      setIsUploadingProof(true);
      setProofError(null);
      const base64 = await readFileAsBase64(proofFile);
      await uploadAttachmentMutation.mutateAsync({
        entityType: 'RENTAL_ORDER',
        entityId: orderId,
        fileName: proofFile.name,
        mimeType: proofFile.type || undefined,
        fileBase64: base64,
        notes: `Bukti transfer DP - ${paymentReference || 'Konfirmasi Order'}`,
      });
      toast.success('Bukti bayar DP berhasil diunggah!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload gagal';
      setProofError(msg);
      toast.error(msg);
    } finally {
      setIsUploadingProof(false);
    }
  }, [orderId, proofFile, paymentReference, uploadAttachmentMutation]);

  const handleDeleteAttachment = useCallback(
    async (attachmentId: string) => {
      await deleteAttachmentMutation.mutateAsync({ id: attachmentId });
    },
    [deleteAttachmentMutation]
  );

  // Derived values
  const totalItems =
    order?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const depositAmount = depositInput;

  // Handlers
  const handleQuickCreatePaymentMethod = useCallback(
    async (name: string) => {
      if (!name.trim()) return;
      const timestamp = Date.now().toString(36).slice(-4);
      const code = `${name.toUpperCase().replace(/\s+/g, '_')}_${timestamp}`;
      await createPaymentMethodMutation.mutateAsync({
        code,
        name,
        type: PaymentMethodTypeSchema.enum.OTHER,
        isDefault: false,
      });
    },
    [createPaymentMethodMutation]
  );

  const handleAccountingTreatmentChange = useCallback((value: string) => {
    if (
      value === 'POST_CASH_JOURNAL' ||
      value === 'OPENING_BALANCE_NO_POSTING'
    ) {
      setAccountingTreatment(value);
      return;
    }

    toast.error('Perlakuan akuntansi tidak valid.');
  }, []);

  const setDepositMethodFromString = useCallback((value: string) => {
    const parsed = RentalPaymentMethodSchema.safeParse(value);
    if (parsed.success) {
      setDepositPaymentMethod(parsed.data);
    } else {
      toast.error('Metode pembayaran DP tidak valid.');
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!order || !canConfirm) return;
    if (depositInput > 0 && !selectedPaymentMethodId) {
      toast.error('Pilih metode pembayaran DP terlebih dahulu.');
      return;
    }
    await apiAction(
      async () => {
        // Upload proof if selected
        if (proofFile && order.id) {
          setIsUploadingProof(true);
          try {
            const base64 = await readFileAsBase64(proofFile);
            await uploadAttachmentMutation.mutateAsync({
              entityType: 'RENTAL_ORDER',
              entityId: order.id,
              fileName: proofFile.name,
              mimeType: proofFile.type || undefined,
              fileBase64: base64,
              notes: `Bukti transfer DP - ${paymentReference || 'Konfirmasi Order'}`,
            });
          } finally {
            setIsUploadingProof(false);
          }
        }

        const payload = ConfirmRentalOrderSchema.parse({
          orderId: order.id,
          depositAmount: depositInput,
          paymentMethodId: selectedPaymentMethodId || undefined,
          paymentMethod: depositPaymentMethod,
          paymentAccountId: depositPaymentAccountId || undefined,
          paymentReference: paymentReference || undefined,
          unitAssignments: [],
        });
        return confirmMutation.mutateAsync(payload);
      },
      'Order dikonfirmasi! Unit otomatis di-assign.'
    );
  }, [
    order,
    canConfirm,
    proofFile,
    depositInput,
    selectedPaymentMethodId,
    depositPaymentMethod,
    depositPaymentAccountId,
    paymentReference,
    confirmMutation,
    uploadAttachmentMutation,
  ]);

  const handleManualConfirm = useCallback(async () => {
    const effectivePaymentMethodId = selectedPaymentMethodId || paymentMethodId;
    if (!effectivePaymentMethodId) {
      toast.error('Pilih metode pembayaran terlebih dahulu.');
      return;
    }
    if (!order || !manualNotes.trim()) return;
    await apiAction(
      async () => {
        // Upload proof if selected
        if (proofFile && order.id) {
          setIsUploadingProof(true);
          try {
            const base64 = await readFileAsBase64(proofFile);
            await uploadAttachmentMutation.mutateAsync({
              entityType: 'RENTAL_ORDER',
              entityId: order.id,
              fileName: proofFile.name,
              mimeType: proofFile.type || undefined,
              fileBase64: base64,
              notes: `Bukti transfer DP - ${paymentReference || 'Konfirmasi Order'}`,
            });
          } finally {
            setIsUploadingProof(false);
          }
        }

        const payload = ManualConfirmRentalOrderSchema.parse({
          orderId: order.id,
          paymentMethodId: effectivePaymentMethodId,
          paymentAmount: paymentAmount || depositInput,
          depositAmount: depositInput,
          paymentMethod: depositPaymentMethod,
          paymentAccountId: depositPaymentAccountId || undefined,
          paymentReference: paymentReference || undefined,
          skipStockCheck,
          accountingTreatment,
          notes: manualNotes,
        });
        return manualConfirmMutation.mutateAsync(payload);
      },
      'Order dikonfirmasi secara manual!'
    );
  }, [
    order,
    selectedPaymentMethodId,
    paymentMethodId,
    manualNotes,
    proofFile,
    paymentAmount,
    depositInput,
    depositPaymentMethod,
    depositPaymentAccountId,
    paymentReference,
    skipStockCheck,
    accountingTreatment,
    manualConfirmMutation,
    uploadAttachmentMutation,
  ]);

  const handleCloseModal = useCallback(() => {
    resetManualConfirmForm();
    onClose();
  }, [onClose, resetManualConfirmForm]);

  const handleOpenQuickAdd = useCallback(() => {
    setShowQuickAddModal(true);
  }, []);

  const handleCloseQuickAdd = useCallback(() => {
    setShowQuickAddModal(false);
  }, []);

  const handleQuickAddSuccess = useCallback(() => {
    utils.rental.items.list.invalidate();
    setShowQuickAddModal(false);
  }, [utils]);

  const enterManualMode = useCallback(() => {
    setManualMode(true);
    setPaymentAmount(depositAmount);
  }, [depositAmount]);

  return {
    // Data
    order,
    isLoading,
    paymentMethods,
    selectedPaymentMethodId,
    handleSelectPaymentMethod,
    selectedPaymentMethod,
    availabilityCheck,
    totalItems,
    depositAmount,
    breakdown,

    // Status flags
    isPaymentPending,
    isPaymentVerified,
    canConfirm,
    showQuickAddModal,
    manualMode,

    // Mutation loading states
    isConfirming: confirmMutation.isPending,
    isManualConfirming: manualConfirmMutation.isPending,

    // Manual form state
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
    accountingTreatment,
    handleAccountingTreatmentChange,

    // DP payment form state
    depositInput,
    setDepositInput,
    depositPaymentMethod,
    setDepositMethodFromString,
    depositPaymentAccountId,
    setDepositPaymentAccountId,
    cashBankAccounts,

    // Proof file upload state & handlers
    proofFile,
    proofPreviewUrl,
    isUploadingProof,
    proofError,
    attachments: attachmentsQuery.data || [],
    isLoadingAttachments: attachmentsQuery.isLoading,
    handleSelectProofFile,
    handleRemoveProofFile,
    handleUploadProofNow,
    handleDeleteAttachment,
    isDeletingAttachment: deleteAttachmentMutation.isPending,

    // Handlers
    handleConfirm,
    handleManualConfirm,
    handleQuickCreatePaymentMethod,
    handleCloseModal,
    handleOpenQuickAdd,
    handleCloseQuickAdd,
    handleQuickAddSuccess,
    enterManualMode,
  };
}
