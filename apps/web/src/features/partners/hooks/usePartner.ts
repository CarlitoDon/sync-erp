import { useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { apiAction } from '@/hooks/useApiAction';
import { trpc } from '@/lib/trpc';

export function usePartner(
  options: { filters?: { type?: 'CUSTOMER' | 'SUPPLIER' } } = {}
) {
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  // List partners using tRPC
  const {
    data: partners,
    isLoading: loading,
    refetch: loadData,
  } = trpc.partner.list.useQuery(
    { type: options.filters?.type },
    { enabled: !!currentCompany?.id }
  );

  // Get partner by ID
  const getPartner = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return undefined;
      const partner = await utils.partner.getById.fetch({ id });
      return partner || undefined;
    },
    [currentCompany?.id, utils]
  );

  // Create partner
  const createPartnerMutation = trpc.partner.create.useMutation({
    onSuccess: () => {
      loadData();
    },
  });

  const createPartner = useCallback(
    async (data: any) => {
      if (!currentCompany?.id) return null;

      const result = await apiAction(
        async () => createPartnerMutation.mutateAsync(data),
        'Partner created successfully'
      );

      return result;
    },
    [currentCompany?.id, createPartnerMutation]
  );

  // Update partner
  const updatePartnerMutation = trpc.partner.update.useMutation({
    onSuccess: () => {
      loadData();
    },
  });

  const updatePartner = useCallback(
    async (id: string, data: any) => {
      if (!currentCompany?.id) return null;

      const result = await apiAction(
        async () => updatePartnerMutation.mutateAsync({ id, data }),
        'Partner updated successfully'
      );

      return result;
    },
    [currentCompany?.id, updatePartnerMutation]
  );

  // Delete partner
  const deletePartnerMutation = trpc.partner.delete.useMutation({
    onSuccess: () => {
      loadData();
    },
  });

  const deletePartner = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return;

      const confirmed = await confirm({
        title: 'Delete Partner',
        message: 'Are you sure you want to delete this partner?',
        confirmText: 'Delete',
        variant: 'danger',
      });

      if (!confirmed) return;

      const result = await apiAction(
        async () => deletePartnerMutation.mutateAsync({ id }),
        'Partner deleted successfully'
      );

      return result;
    },
    [currentCompany?.id, confirm, deletePartnerMutation]
  );

  return {
    partners: partners || [],
    loading,
    loadData,
    getPartner,
    createPartner,
    updatePartner,
    deletePartner,
  };
}

export default usePartner;
