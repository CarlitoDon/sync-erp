/**
 * useBillActions
 *
 * Manages bill mutations and action handlers.
 * Extracted from BillDetail.tsx to reduce component complexity.
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm, usePrompt } from '@/components/ui';

interface UseBillActionsOptions {
  billId: string;
}

export function useBillActions({ billId }: UseBillActionsOptions) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const utils = trpc.useUtils();

  // Modal state
  const [showPayment, setShowPayment] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Mutations
  const postMutation = trpc.bill.post.useMutation({
    onSuccess: () => {
      utils.bill.getById.invalidate({ id: billId });
      utils.bill.list.invalidate();
      utils.purchaseOrder.list.invalidate();
    },
  });

  const voidMutation = trpc.bill.void.useMutation({
    onSuccess: () => {
      utils.bill.getById.invalidate({ id: billId });
      utils.bill.list.invalidate();
      utils.purchaseOrder.list.invalidate();
    },
  });

  const deleteMutation = trpc.bill.delete.useMutation({
    onSuccess: () => {
      utils.bill.list.invalidate();
      utils.purchaseOrder.list.invalidate();
      navigate('/bills');
    },
  });

  // Handlers
  const handlePost = useCallback(async () => {
    await apiAction(
      () => postMutation.mutateAsync({ id: billId }),
      'Bill posted!'
    );
  }, [billId, postMutation]);

  const handleVoid = useCallback(async () => {
    const reason = await prompt({
      title: 'Void Bill',
      message: 'Please enter a reason for voiding this bill:',
      placeholder: 'Enter reason...',
      required: true,
    });
    if (!reason) return;

    const confirmed = await confirm({
      title: 'Void Bill',
      message: 'Are you sure you want to void this bill?',
      confirmText: 'Yes, Void',
      variant: 'danger',
    });
    if (!confirmed) return;

    await apiAction(
      () => voidMutation.mutateAsync({ id: billId, reason }),
      'Bill voided'
    );
  }, [billId, confirm, prompt, voidMutation]);

  const handleDelete = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Delete Bill',
      message:
        'Are you sure you want to delete this draft bill? This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    await apiAction(
      () => deleteMutation.mutateAsync({ id: billId }),
      'Bill deleted successfully'
    );
  }, [billId, confirm, deleteMutation]);

  return {
    // Mutations loading states
    isPosting: postMutation.isPending,
    isVoiding: voidMutation.isPending,
    isDeleting: deleteMutation.isPending,

    // Handlers
    handlePost,
    handleVoid,
    handleDelete,

    // Payment modal
    paymentModal: {
      isOpen: showPayment,
      open: () => setShowPayment(true),
      close: () => setShowPayment(false),
      onSuccess: () => utils.bill.getById.invalidate({ id: billId }),
    },

    // History modal
    historyModal: {
      isOpen: showHistory,
      open: () => setShowHistory(true),
      close: () => setShowHistory(false),
    },
  };
}
