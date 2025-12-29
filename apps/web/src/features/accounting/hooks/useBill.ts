import { useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { apiAction } from '@/hooks/useApiAction';
import { trpc } from '@/lib/trpc';

// Export CreateBillInput for API - uses Date objects
export interface CreateBillInput {
  orderId: string;
  supplierInvoiceNumber?: string; // External reference from supplier
  dueDate?: Date;
  taxRate?: number;
  businessDate?: Date;
  paymentTermsString?: string;
}

interface UseBillOptions {
  filters?: {
    status?: string;
  };
}

export function useBill(options: UseBillOptions = {}) {
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  // List bills using tRPC
  const {
    data: bills,
    isLoading: loading,
    refetch: loadData,
  } = trpc.bill.list.useQuery(
    { status: options.filters?.status },
    { enabled: !!currentCompany?.id }
  );

  // Get bill by ID
  const getBill = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return undefined;
      return await utils.bill.getById.fetch({ id });
    },
    [currentCompany?.id, utils]
  );

  // Create bill from PO
  const createBillMutation = trpc.bill.createFromPO.useMutation({
    onSuccess: () => {
      loadData();
    },
  });

  const createFromPO = useCallback(
    async (data: CreateBillInput) => {
      if (!currentCompany?.id) return null;

      const result = await apiAction(
        async () => createBillMutation.mutateAsync(data),
        'Bill created successfully!'
      );

      return result;
    },
    [currentCompany?.id, createBillMutation]
  );

  // Post bill
  const postBillMutation = trpc.bill.post.useMutation({
    onSuccess: () => {
      loadData();
    },
  });

  const postBill = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return;

      const confirmed = await confirm({
        title: 'Post Bill',
        message: 'This will post the bill to the ledger. Continue?',
        confirmText: 'Post',
      });

      if (!confirmed) return;

      const result = await apiAction(
        async () => postBillMutation.mutateAsync({ id }),
        'Bill posted successfully!'
      );

      return result;
    },
    [currentCompany?.id, confirm, postBillMutation]
  );

  // Void bill (FR-024: requires reason)
  const voidBillMutation = trpc.bill.void.useMutation({
    onSuccess: () => {
      loadData();
    },
  });

  const voidBill = useCallback(
    async (id: string, reason: string) => {
      if (!currentCompany?.id) return;

      // Reason is required - callers should use usePrompt() before calling
      if (!reason || reason.trim().length === 0) {
        return; // Invalid reason
      }

      const confirmed = await confirm({
        title: 'Void Bill',
        message:
          'Are you sure you want to void this bill? This cannot be undone.',
        confirmText: 'Void',
        variant: 'danger',
      });

      if (!confirmed) return;

      const result = await apiAction(
        async () =>
          voidBillMutation.mutateAsync({ id, reason }),
        'Bill voided successfully!'
      );

      return result;
    },
    [currentCompany?.id, confirm, voidBillMutation]
  );

  return {
    bills: bills || [],
    loading,
    refresh: loadData,
    getBill,
    createFromPO,
    postBill,
    voidBill,
  };
}
