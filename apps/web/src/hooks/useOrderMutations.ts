import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm } from '@/components/ui/ConfirmModal';

/* eslint-disable @sync-erp/no-hardcoded-enum */
type OrderType = 'purchase' | 'sales';
/* eslint-enable @sync-erp/no-hardcoded-enum */

interface UseOrderMutationsOptions {
  /** Order type: 'purchase' or 'sales' */
  type: OrderType;
  /** Callback after successful mutation */
  onSuccess?: () => void;
}

/**
 * Shared hook for order confirm/cancel mutations.
 * Works with both PurchaseOrder and SalesOrder.
 *
 * @example
 * const { handleConfirm, handleCancel, isConfirming, isCancelling } = useOrderMutations({
 *   type: 'purchase',
 *   onSuccess: () => utils.purchaseOrder.list.invalidate()
 * });
 */
export function useOrderMutations({
  type,
  onSuccess,
}: UseOrderMutationsOptions) {
  const confirm = useConfirm();

  // Purchase order mutations
  const poConfirmMutation = trpc.purchaseOrder.confirm.useMutation({
    onSuccess,
  });
  const poCancelMutation = trpc.purchaseOrder.cancel.useMutation({
    onSuccess,
  });

  // Sales order mutations
  const soConfirmMutation = trpc.salesOrder.confirm.useMutation({
    onSuccess,
  });
  const soCancelMutation = trpc.salesOrder.cancel.useMutation({
    onSuccess,
  });

  const isPurchase = type === 'purchase';
  const confirmMutation = isPurchase
    ? poConfirmMutation
    : soConfirmMutation;
  const cancelMutation = isPurchase
    ? poCancelMutation
    : soCancelMutation;

  const handleConfirm = async (id: string) => {
    await apiAction(
      () => confirmMutation.mutateAsync({ id }),
      'Order confirmed!'
    );
  };

  const handleCancel = async (id: string) => {
    const confirmed = await confirm({
      title: 'Cancel Order',
      message: 'Are you sure you want to cancel this order?',
      confirmText: 'Yes, Cancel',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () => cancelMutation.mutateAsync({ id }),
      'Order cancelled'
    );
  };

  return {
    handleConfirm,
    handleCancel,
    isConfirming: confirmMutation.isPending,
    isCancelling: cancelMutation.isPending,
  };
}
