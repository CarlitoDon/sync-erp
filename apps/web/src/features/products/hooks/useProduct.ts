import { useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { apiAction } from '@/hooks/useApiAction';
import { trpc } from '@/lib/trpc';

export function useProduct() {
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  // List products using tRPC
  const {
    data: products,
    isLoading: loading,
    refetch: loadData,
  } = trpc.product.list.useQuery(undefined, {
    enabled: !!currentCompany?.id,
  });

  // Get product by ID
  const getProduct = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return undefined;
      const product = await utils.product.getById.fetch({ id });
      return product || undefined;
    },
    [currentCompany?.id, utils]
  );

  // Create product
  const createProductMutation = trpc.product.create.useMutation({
    onSuccess: () => {
      loadData();
    },
  });

  const createProduct = useCallback(
    async (data: any) => {
      if (!currentCompany?.id) return null;

      const result = await apiAction(
        async () => createProductMutation.mutateAsync(data),
        'Product created successfully'
      );

      return result;
    },
    [currentCompany?.id, createProductMutation]
  );

  // Update product
  const updateProductMutation = trpc.product.update.useMutation({
    onSuccess: () => {
      loadData();
    },
  });

  const updateProduct = useCallback(
    async (id: string, data: any) => {
      if (!currentCompany?.id) return null;

      const result = await apiAction(
        async () => updateProductMutation.mutateAsync({ id, data }),
        'Product updated successfully'
      );

      return result;
    },
    [currentCompany?.id, updateProductMutation]
  );

  // Delete product
  const deleteProductMutation = trpc.product.delete.useMutation({
    onSuccess: () => {
      loadData();
    },
  });

  const deleteProduct = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return;

      const confirmed = await confirm({
        title: 'Delete Product',
        message: 'Are you sure you want to delete this product?',
        confirmText: 'Delete',
        variant: 'danger',
      });

      if (!confirmed) return;

      const result = await apiAction(
        async () => deleteProductMutation.mutateAsync({ id }),
        'Product deleted successfully'
      );

      return result;
    },
    [currentCompany?.id, confirm, deleteProductMutation]
  );

  return {
    products: products || [],
    loading,
    loadData,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}

export default useProduct;
