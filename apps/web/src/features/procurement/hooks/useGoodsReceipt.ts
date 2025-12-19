import { useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { trpc, RouterInputs } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';

type CreateGRNInput = RouterInputs['inventory']['createGRN'];

// We'll trust tRPC types mostly, but for return interface we might need some adaptation
export interface UseGoodsReceiptOptions {}

export function useGoodsReceipt(
  _options: UseGoodsReceiptOptions = {}
) {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  const {
    data: receipts = [],
    isLoading: loading,
    refetch: refresh,
  } = trpc.inventory.listGRN.useQuery(undefined, {
    enabled: !!currentCompany?.id,
  });

  const createMutation = trpc.inventory.createGRN.useMutation({
    onSuccess: () => {
      utils.inventory.listGRN.invalidate();
      utils.purchaseOrder.list.invalidate(); // Update PO list status
    },
  });

  const postMutation = trpc.inventory.postGRN.useMutation({
    onSuccess: () => {
      utils.inventory.listGRN.invalidate();
      utils.purchaseOrder.list.invalidate();
    },
  });

  const createReceipt = useCallback(
    async (data: CreateGRNInput) => {
      if (!currentCompany?.id) return undefined;
      return await apiAction(
        () =>
          createMutation.mutateAsync({
            ...data,
          }),
        'Goods Receipt created!'
      );
    },
    [currentCompany, createMutation]
  );

  const postReceipt = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return undefined;
      return await apiAction(
        () =>
          postMutation.mutateAsync({
            id,
          }),
        'Goods Receipt posted to inventory!'
      );
    },
    [currentCompany, postMutation]
  );

  const getReceipt = useCallback(
    async (id: string) => {
      // For now, we don't have a direct async getter other than query,
      // but usually this is used for details page which uses useQuery.
      // If imperative fetch is needed, we can use utils.client
      return await utils.client.inventory.getGRN.query({
        id,
      });
    },
    [currentCompany, utils]
  );

  return {
    receipts,
    loading,
    refresh,
    createReceipt,
    postReceipt,
    getReceipt,
  };
}

export default useGoodsReceipt;
