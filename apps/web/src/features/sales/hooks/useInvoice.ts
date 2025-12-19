import { useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { apiAction } from '@/hooks/useApiAction';
import { trpc } from '@/lib/trpc';

export function useInvoice(
  options: { filters?: { status?: string } } = {}
) {
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  // List invoices using tRPC
  const {
    data: invoices,
    isLoading: loading,
    refetch: loadData,
  } = trpc.invoice.list.useQuery(
    { status: options.filters?.status },
    { enabled: !!currentCompany?.id }
  );

  // Get invoice by ID
  const getInvoice = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return undefined;
      const invoice = await utils.invoice.getById.fetch({ id });
      return invoice || undefined;
    },
    [currentCompany?.id, utils]
  );

  // Create invoice from SO
  const createInvoiceMutation = trpc.invoice.createFromSO.useMutation(
    {
      onSuccess: () => {
        loadData();
      },
    }
  );

  const createInvoice = useCallback(
    async (data: any) => {
      if (!currentCompany?.id) return null;

      const result = await apiAction(
        async () => createInvoiceMutation.mutateAsync(data),
        'Invoice created successfully'
      );

      return result;
    },
    [currentCompany?.id, createInvoiceMutation]
  );

  // Post invoice
  const postInvoiceMutation = trpc.invoice.post.useMutation({
    onSuccess: () => {
      loadData();
    },
  });

  const postInvoice = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return;

      const confirmed = await confirm({
        title: 'Post Invoice',
        message: 'This will post the invoice. Continue?',
        confirmText: 'Post',
      });

      if (!confirmed) return;

      const result = await apiAction(
        async () => postInvoiceMutation.mutateAsync({ id }),
        'Invoice posted successfully'
      );

      return result;
    },
    [currentCompany?.id, confirm, postInvoiceMutation]
  );

  // Void invoice
  const voidInvoiceMutation = trpc.invoice.void.useMutation({
    onSuccess: () => {
      loadData();
    },
  });

  const voidInvoice = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return;

      const confirmed = await confirm({
        title: 'Void Invoice',
        message: 'Are you sure you want to void this invoice?',
        confirmText: 'Void',
        variant: 'danger',
      });

      if (!confirmed) return;

      const result = await apiAction(
        async () => voidInvoiceMutation.mutateAsync({ id }),
        'Invoice voided successfully'
      );

      return result;
    },
    [currentCompany?.id, confirm, voidInvoiceMutation]
  );

  return {
    invoices: invoices || [],
    loading,
    loadData,
    getInvoice,
    createInvoice,
    postInvoice,
    voidInvoice,
  };
}

export default useInvoice;
