import { useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { apiAction } from '@/hooks/useApiAction';
import { trpc } from '@/lib/trpc';

interface UsePurchaseOrderOptions {
  filters?: {
    status?: string;
  };
}

export function usePurchaseOrder(
  options: UsePurchaseOrderOptions = {}
) {
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  // List purchase orders using tRPC
  const {
    data: orders,
    isLoading: loading,
    refetch: loadData,
  } = trpc.purchaseOrder.list.useQuery(
    { status: options.filters?.status },
    { enabled: !!currentCompany?.id }
  );

  // Get PO by ID
  const getOrder = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return undefined;
      const order = await utils.purchaseOrder.getById.fetch({ id });
      return order || undefined;
    },
    [currentCompany?.id, utils]
  );

  // Create PO
  const createOrderMutation = trpc.purchaseOrder.create.useMutation({
    onSuccess: () => {
      loadData();
    },
  });

  const createOrder = useCallback(
    async (data: any) => {
      if (!currentCompany?.id) return null;

      const result = await apiAction(
        async () => createOrderMutation.mutateAsync(data),
        'Purchase order created successfully'
      );

      return result;
    },
    [currentCompany?.id, createOrderMutation]
  );

  // Confirm PO
  const confirmOrderMutation = trpc.purchaseOrder.confirm.useMutation(
    {
      onSuccess: () => {
        loadData();
      },
    }
  );

  const confirmOrder = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return;

      const confirmed = await confirm({
        title: 'Confirm Purchase Order',
        message: 'Confirm this purchase order?',
        confirmText: 'Confirm',
      });

      if (!confirmed) return;

      const result = await apiAction(
        async () => confirmOrderMutation.mutateAsync({ id }),
        'Purchase order confirmed'
      );

      return result;
    },
    [currentCompany?.id, confirm, confirmOrderMutation]
  );

  // Cancel PO
  const cancelOrderMutation = trpc.purchaseOrder.cancel.useMutation({
    onSuccess: () => {
      loadData();
    },
  });

  const cancelOrder = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return;

      const confirmed = await confirm({
        title: 'Cancel Order',
        message: 'Are you sure you want to cancel this order?',
        confirmText: 'Yes, Cancel',
        variant: 'danger',
      });

      if (!confirmed) return;

      const result = await apiAction(
        async () => cancelOrderMutation.mutateAsync({ id }),
        'Order cancelled'
      );

      return result;
    },
    [currentCompany?.id, confirm, cancelOrderMutation]
  );

  return {
    orders: orders || [],
    loading,
    refresh: loadData,
    getOrder,
    createOrder,
    confirmOrder,
    cancelOrder,
  };
}

export default usePurchaseOrder;
