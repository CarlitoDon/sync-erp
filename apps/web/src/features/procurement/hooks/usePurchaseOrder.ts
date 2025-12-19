import { useCallback } from 'react';
import { useCompanyData } from '@/hooks/useCompanyData';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm } from '@/components/ui/ConfirmModal';
import {
  purchaseOrderService,
  PurchaseOrder,
  CreatePurchaseOrderInput,
} from '@/features/procurement/services/purchaseOrderService';

export interface UsePurchaseOrderOptions {
  filters?: { status?: string; partnerId?: string };
}

export interface UsePurchaseOrderReturn {
  orders: PurchaseOrder[];
  loading: boolean;
  refresh: () => Promise<void>;
  createOrder: (
    data: CreatePurchaseOrderInput
  ) => Promise<PurchaseOrder | undefined>;
  confirmOrder: (id: string) => Promise<void>;
  cancelOrder: (id: string) => Promise<void>;
  getOrder: (id: string) => Promise<PurchaseOrder | undefined>;
}

/**
 * Hook for managing Purchase Order operations.
 * Encapsulates list fetching, CRUD actions with toast notifications.
 */
export function usePurchaseOrder(
  options: UsePurchaseOrderOptions = {}
): UsePurchaseOrderReturn {
  const confirm = useConfirm();

  const {
    data: orders,
    loading,
    refresh,
  } = useCompanyData<PurchaseOrder[]>(
    useCallback(
      () => purchaseOrderService.list(options.filters),
      [JSON.stringify(options.filters)]
    ),
    []
  );

  const createOrder = useCallback(
    async (data: CreatePurchaseOrderInput) => {
      const result = await apiAction(
        () => purchaseOrderService.create(data),
        'Purchase Order created!'
      );
      if (result) {
        refresh();
      }
      return result;
    },
    [refresh]
  );

  const confirmOrder = useCallback(
    async (id: string) => {
      await apiAction(
        () => purchaseOrderService.confirm(id),
        'Order confirmed!'
      );
      refresh();
    },
    [refresh]
  );

  const cancelOrder = useCallback(
    async (id: string) => {
      const confirmed = await confirm({
        title: 'Cancel Order',
        message: 'Are you sure you want to cancel this order?',
        confirmText: 'Yes, Cancel',
        variant: 'danger',
      });
      if (!confirmed) return;

      await apiAction(
        () => purchaseOrderService.cancel(id),
        'Order cancelled'
      );
      refresh();
    },
    [confirm, refresh]
  );

  const getOrder = useCallback(async (id: string) => {
    return purchaseOrderService.getById(id);
  }, []);

  return {
    orders,
    loading,
    refresh,
    createOrder,
    confirmOrder,
    cancelOrder,
    getOrder,
  };
}

export default usePurchaseOrder;
