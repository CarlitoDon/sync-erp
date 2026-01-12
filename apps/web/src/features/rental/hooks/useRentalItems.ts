import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { UnitStatus, UnitCondition } from '@sync-erp/shared';
import type {
  RentalItemWithRelations,
  CreateRentalItemInput,
} from '@sync-erp/shared';

interface AddUnitInput {
  rentalItemId: string;
  unitCode: string;
  condition: UnitCondition;
}

interface BulkAddUnitsInput {
  rentalItemId: string;
  prefix: string;
  quantity: number;
  startNumber: number;
  condition: UnitCondition;
}

interface ConvertStockInput {
  rentalItemId: string;
  quantity: number;
  prefix: string;
  startNumber: number;
}

/**
 * Hook for managing rental items - queries, mutations, and helper functions.
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

  const addUnitMutation = trpc.rental.items.addUnit.useMutation({
    onSuccess: () => utils.rental.items.list.invalidate(),
  });

  const bulkAddUnitsMutation =
    trpc.rental.items.bulkAddUnits.useMutation({
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

  const addUnit = async (input: AddUnitInput) => {
    return apiAction(
      () => addUnitMutation.mutateAsync(input),
      'Unit berhasil ditambahkan'
    );
  };

  const bulkAddUnits = async (input: BulkAddUnitsInput) => {
    return apiAction(
      () => bulkAddUnitsMutation.mutateAsync(input),
      `Berhasil membuat ${input.quantity} unit baru`
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
    addUnit,
    bulkAddUnits,
    convertStock,
    refetch,

    // Helpers
    getAvailableCount,
    getTotalCount,

    // Loading states
    isCreating: createMutation.isPending,
    isAddingUnit: addUnitMutation.isPending,
    isBulkAdding: bulkAddUnitsMutation.isPending,
    isConverting: convertStockMutation.isPending,
  };
}
