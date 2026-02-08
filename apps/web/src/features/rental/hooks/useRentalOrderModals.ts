/**
 * useRentalOrderModals
 *
 * Manages modal state for rental order detail page.
 * Extracted to reduce component complexity.
 */
import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';

export function useRentalOrderModals(orderId: string | undefined) {
  const utils = trpc.useUtils();

  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isVerifyPaymentOpen, setIsVerifyPaymentOpen] =
    useState(false);

  const invalidateOrder = useCallback(() => {
    if (orderId) {
      utils.rental.orders.getById.invalidate({ id: orderId });
    }
  }, [orderId, utils]);

  return {
    release: {
      isOpen: isReleaseModalOpen,
      open: () => setIsReleaseModalOpen(true),
      close: () => setIsReleaseModalOpen(false),
      onSuccess: () => {
        invalidateOrder();
        setIsReleaseModalOpen(false);
      },
    },
    cancel: {
      isOpen: isCancelModalOpen,
      open: () => setIsCancelModalOpen(true),
      close: () => setIsCancelModalOpen(false),
      onSuccess: () => setIsCancelModalOpen(false),
    },
    confirm: {
      isOpen: isConfirmModalOpen,
      open: () => setIsConfirmModalOpen(true),
      close: () => setIsConfirmModalOpen(false),
      onSuccess: () => {
        invalidateOrder();
        setIsConfirmModalOpen(false);
      },
    },
    return: {
      isOpen: isReturnModalOpen,
      open: () => setIsReturnModalOpen(true),
      close: () => setIsReturnModalOpen(false),
      onSuccess: () => {
        invalidateOrder();
        setIsReturnModalOpen(false);
      },
    },
    verifyPayment: {
      isOpen: isVerifyPaymentOpen,
      open: () => setIsVerifyPaymentOpen(true),
      close: () => setIsVerifyPaymentOpen(false),
      onSuccess: () => {
        invalidateOrder();
        setIsVerifyPaymentOpen(false);
      },
    },
  };
}
