import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { RentalOrderStatus } from '@sync-erp/shared';

interface CreateOrderInput {
  partnerId: string;
  rentalStartDate: string;
  rentalEndDate: string;
  dueDateTime: string;
  notes?: string;
  items: { rentalItemId: string; quantity: number }[];
}

/**
 * Hook for managing rental orders - queries, mutations, and filtering.
 */
export function useRentalOrders() {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  // Status filter state
  const [statusFilter, setStatusFilter] = useState<
    RentalOrderStatus | 'ALL'
  >('ALL');

  // Query - extract items from paginated response
  const {
    data: ordersData,
    isLoading,
    refetch,
  } = trpc.rental.orders.list.useQuery(undefined, {
    enabled: !!currentCompany?.id,
  });
  const orders = ordersData?.items ?? [];

  // Mutations
  const createMutation = trpc.rental.orders.create.useMutation({
    onSuccess: () => utils.rental.orders.list.invalidate(),
  });

  const cancelMutation = trpc.rental.orders.cancel.useMutation({
    onSuccess: () => utils.rental.orders.list.invalidate(),
  });

  // Filtered orders
  const filteredOrders =
    statusFilter === 'ALL'
      ? orders
      : orders.filter((o) => o.status === statusFilter);

  // Actions
  const createOrder = async (input: CreateOrderInput) => {
    return apiAction(
      () => createMutation.mutateAsync(input),
      'Order berhasil dibuat'
    );
  };

  const cancelOrder = async (orderId: string, reason: string) => {
    return apiAction(
      () => cancelMutation.mutateAsync({ orderId, reason }),
      'Order dibatalkan'
    );
  };

  return {
    // Data
    orders,
    filteredOrders,
    isLoading,

    // Filter
    statusFilter,
    setStatusFilter,

    // Actions
    createOrder,
    cancelOrder,
    refetch,

    // Loading states
    isCreating: createMutation.isPending,
    isCancelling: cancelMutation.isPending,
  };
}
