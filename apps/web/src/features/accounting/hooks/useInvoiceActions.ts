/**
 * useInvoiceActions
 *
 * Manages invoice mutations and action handlers.
 * Extracted from InvoiceDetail.tsx to reduce component complexity and improve testability.
 */
import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm, usePrompt } from '@/components/ui';

interface UseInvoiceActionsOptions {
  invoiceId: string;
}

export function useInvoiceActions({
  invoiceId,
}: UseInvoiceActionsOptions) {
  const confirm = useConfirm();
  const prompt = usePrompt();
  const utils = trpc.useUtils();

  // Modal state
  const [showPayment, setShowPayment] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Mutations
  const postMutation = trpc.invoice.post.useMutation({
    onSuccess: () => {
      utils.invoice.getById.invalidate({ id: invoiceId });
      utils.invoice.list.invalidate();
      utils.salesOrder.list.invalidate(); // SO status may change
    },
  });

  const voidMutation = trpc.invoice.void.useMutation({
    onSuccess: () => {
      utils.invoice.getById.invalidate({ id: invoiceId });
      utils.invoice.list.invalidate();
      utils.salesOrder.list.invalidate(); // SO status may change
    },
  });

  // Handlers
  const handlePost = useCallback(async () => {
    await apiAction(
      () => postMutation.mutateAsync({ id: invoiceId }),
      'Invoice posted!'
    );
  }, [invoiceId, postMutation]);

  const handleVoid = useCallback(async () => {
    const reason = await prompt({
      title: 'Void Invoice',
      message: 'Please enter a reason for voiding this invoice:',
      placeholder: 'Enter reason...',
      required: true,
    });
    if (!reason) return;

    const confirmed = await confirm({
      title: 'Void Invoice',
      message: 'Are you sure you want to void this invoice?',
      confirmText: 'Yes, Void',
      variant: 'danger',
    });
    if (!confirmed) return;

    await apiAction(
      () => voidMutation.mutateAsync({ id: invoiceId, reason }),
      'Invoice voided'
    );
  }, [invoiceId, confirm, prompt, voidMutation]);

  return {
    // Loading states
    isPosting: postMutation.isPending,
    isVoiding: voidMutation.isPending,

    // Handlers
    handlePost,
    handleVoid,

    // Payment modal
    paymentModal: {
      isOpen: showPayment,
      open: () => setShowPayment(true),
      close: () => setShowPayment(false),
      onSuccess: () =>
        utils.invoice.getById.invalidate({ id: invoiceId }),
    },

    // History modal
    historyModal: {
      isOpen: showHistory,
      open: () => setShowHistory(true),
      close: () => setShowHistory(false),
    },
  };
}
