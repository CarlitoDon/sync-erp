import { useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { apiAction } from '@/hooks/useApiAction';
import { trpc } from '@/lib/trpc';
import type { Invoice } from '@sync-erp/shared';

// Export CreateBillInput for BillForm
export interface CreateBillInput {
  orderId: string;
  invoiceNumber?: string;
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
    async (id: string): Promise<Invoice | undefined> => {
      if (!currentCompany?.id) return undefined;
      const bill = await utils.bill.getById.fetch({ id });
      return (bill as unknown as Invoice) || undefined;
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

  // Void bill
  const voidBillMutation = trpc.bill.void.useMutation({
    onSuccess: () => {
      loadData();
    },
  });

  const voidBill = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return;

      const confirmed = await confirm({
        title: 'Void Bill',
        message:
          'Are you sure you want to void this bill? This cannot be undone.',
        confirmText: 'Void',
        variant: 'danger',
      });

      if (!confirmed) return;

      const result = await apiAction(
        async () => voidBillMutation.mutateAsync({ id }),
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

export default useBill;
