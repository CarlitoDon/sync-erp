import { useState, useMemo, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';
import {
  RentalPaymentStatus,
  PaymentMethodTypeSchema,
} from '@sync-erp/shared';
import { toast } from 'react-hot-toast';

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
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentReference, setPaymentReference] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [skipStockCheck, setSkipStockCheck] = useState(false);

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
    paymentStatus === RentalPaymentStatus.CONFIRMED ||
    paymentStatus === RentalPaymentStatus.AWAITING_CONFIRM;
  const isPaymentPending =
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
        setManualMode(false);
        onSuccess();
        onClose();
      },
    });

  const createPaymentMethodMutation =
    trpc.paymentMethod.create.useMutation({
      onSuccess: (data) => {
        utils.paymentMethod.list.invalidate();
        setPaymentMethodId(data.id);
        toast.success(`Metode "${data.name}" berhasil dibuat!`);
      },
      onError: (error) => {
        toast.error(`Gagal membuat metode: ${error.message}`);
      },
    });

  // Derived values
  const totalItems =
    order?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const depositAmount = order?.depositAmount
    ? Number(order.depositAmount)
    : 0;

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

  const handleConfirm = useCallback(async () => {
    if (!order || !canConfirm) return;
    await apiAction(
      () => confirmMutation.mutateAsync({ orderId: order.id }),
      'Order dikonfirmasi! Unit otomatis di-assign.'
    );
  }, [order, canConfirm, confirmMutation]);

  const handleManualConfirm = useCallback(async () => {
    if (!order || !paymentMethodId || !manualNotes.trim()) return;
    await apiAction(
      () =>
        manualConfirmMutation.mutateAsync({
          orderId: order.id,
          paymentMethodId,
          paymentAmount: paymentAmount || depositAmount,
          paymentReference: paymentReference || undefined,
          skipStockCheck,
          notes: manualNotes,
        }),
      'Order dikonfirmasi secara manual!'
    );
  }, [
    order,
    paymentMethodId,
    manualNotes,
    manualConfirmMutation,
    paymentAmount,
    depositAmount,
    paymentReference,
    skipStockCheck,
  ]);

  const handleCloseModal = useCallback(() => {
    setManualMode(false);
    onClose();
  }, [onClose]);

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
    availabilityCheck,
    totalItems,
    depositAmount,

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
