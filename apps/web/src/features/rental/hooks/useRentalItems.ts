import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { UnitStatus } from '@sync-erp/shared';
import type {
  RentalItemWithRelations,
  CreateRentalItemInput,
} from '@sync-erp/shared';

interface ConvertStockInput {
  rentalItemId: string;
  quantity: number;
  prefix: string;
  startNumber: number;
}

/**
 * Hook for managing rental items - queries, mutations, and helper functions.
 * NOTE: addUnit and bulkAddUnits removed - all units must be created via convertStock
 */
export function useRentalItems() {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  // Query
  const {
    data: items = [],
    isLoading,
    refetch,
  } = trpc.rental.items.list.useQuery(undefined, {
    enabled: !!currentCompany?.id,
  });

  // Mutations
  const createMutation = trpc.rental.items.create.useMutation({
    onSuccess: () => utils.rental.items.list.invalidate(),
  });

  const convertStockMutation =
    trpc.rental.items.convertStock.useMutation({
      onSuccess: () => {
        utils.rental.items.list.invalidate();
        utils.product.list.invalidate();
      },
    });

  // Helper functions
  const getAvailableCount = (
    units: RentalItemWithRelations['units']
  ): number => {
    return (
      units?.filter((u) => u.status === UnitStatus.AVAILABLE)
        .length || 0
    );
  };

  const getTotalCount = (
    units: RentalItemWithRelations['units']
  ): number => {
    return units?.length || 0;
  };

  // Actions
  const createItem = async (input: CreateRentalItemInput) => {
    return apiAction(
      () => createMutation.mutateAsync(input),
      'Item rental berhasil dibuat'
    );
  };

  const convertStock = async (input: ConvertStockInput) => {
    return apiAction(
      () => convertStockMutation.mutateAsync(input),
      `Berhasil mengkonversi ${input.quantity} unit dari stok`
    );
  };

  return {
    // Data
    items,
    isLoading,

    // Actions
    createItem,
    convertStock,
    refetch,

    // Helpers
    getAvailableCount,
    getTotalCount,

    // Loading states
    isCreating: createMutation.isPending,
    isConverting: convertStockMutation.isPending,
  };
}
