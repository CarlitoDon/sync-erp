import { useCallback } from 'react';
import { useCompanyData } from '@/hooks/useCompanyData';
import { apiAction } from '@/hooks/useApiAction';
import { useCompany } from '@/contexts/CompanyContext';
import {
  createGoodsReceipt,
  listGoodsReceipts,
  getGoodsReceipt,
  postGoodsReceipt,
  CreateGoodsReceiptInput,
  GoodsReceiptResponse,
} from '@/features/inventory/services/inventoryService';

export interface UseGoodsReceiptOptions {
  // Add filters if needed in future
}

export interface UseGoodsReceiptReturn {
  receipts: GoodsReceiptResponse[];
  loading: boolean;
  refresh: () => Promise<void>;
  createReceipt: (
    data: CreateGoodsReceiptInput
  ) => Promise<GoodsReceiptResponse | undefined>;
  postReceipt: (
    id: string
  ) => Promise<GoodsReceiptResponse | undefined>;
  getReceipt: (id: string) => Promise<GoodsReceiptResponse | null>;
}

/**
 * Hook for managing Goods Receipt operations.
 * bridges Procurement flow (PO) with Inventory module (GRN).
 */
export function useGoodsReceipt(
  _options: UseGoodsReceiptOptions = {}
): UseGoodsReceiptReturn {
  const { currentCompany } = useCompany();

  const {
    data: receipts,
    loading,
    refresh,
  } = useCompanyData<GoodsReceiptResponse[]>(
    useCallback(async (companyId) => {
      return await listGoodsReceipts(companyId);
    }, []),
    []
  );

  const createReceipt = useCallback(
    async (data: CreateGoodsReceiptInput) => {
      if (!currentCompany?.id) return undefined;

      const result = await apiAction(
        () => createGoodsReceipt(currentCompany.id, data),
        'Goods Receipt created!'
      );
      if (result) {
        refresh();
      }
      return result;
    },
    [currentCompany?.id, refresh]
  );

  const postReceipt = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return undefined;

      const result = await apiAction(
        () => postGoodsReceipt(currentCompany.id, id),
        'Goods Receipt posted to inventory!'
      );
      if (result) {
        refresh();
      }
      return result;
    },
    [currentCompany?.id, refresh]
  );

  const getReceipt = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return null;
      return getGoodsReceipt(currentCompany.id, id);
    },
    [currentCompany?.id]
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
