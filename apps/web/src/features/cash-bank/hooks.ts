import { useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { apiAction } from '@/hooks/useApiAction';
import { trpc } from '@/lib/trpc';
import { CashTransactionStatusType } from '@sync-erp/shared';
import {
  CreateBankAccountInput,
  UpdateBankAccountInput,
  CreateCashTransactionInput,
} from '@sync-erp/shared';

// ===================================
// Bank Accounts
// ===================================

export function useBankAccounts() {
  const { currentCompany } = useCompany();

  const {
    data: accounts,
    isLoading: loading,
    refetch,
  } = trpc.cashBank.listAccounts.useQuery(undefined, {
    enabled: !!currentCompany?.id,
  });

  const createAccountMutation =
    trpc.cashBank.createAccount.useMutation({
      onSuccess: () => refetch(),
    });

  const createAccount = useCallback(
    async (data: CreateBankAccountInput) => {
      return apiAction(
        () => createAccountMutation.mutateAsync(data),
        'Bank Account created successfully!'
      );
    },
    [createAccountMutation]
  );

  const updateAccountMutation =
    trpc.cashBank.updateAccount.useMutation({
      onSuccess: () => refetch(),
    });

  const updateAccount = useCallback(
    async (id: string, data: UpdateBankAccountInput) => {
      return apiAction(
        () => updateAccountMutation.mutateAsync({ id, ...data }),
        'Bank Account updated successfully!'
      );
    },
    [updateAccountMutation]
  );

  return {
    accounts: accounts || [],
    loading,
    refresh: refetch,
    createAccount,
    updateAccount,
    isCreating: createAccountMutation.isPending,
    isUpdating: updateAccountMutation.isPending,
  };
}

// ===================================
// Cash Transactions
// ===================================

interface UseCashTransactionsOptions {
  bankAccountId?: string;
  status?: CashTransactionStatusType;
  startDate?: Date;
  endDate?: Date;
}

export function useCashTransactions(
  options: UseCashTransactionsOptions = {}
) {
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const {
    data: transactions,
    isLoading: loading,
    refetch,
  } = trpc.cashBank.listTransactions.useQuery(
    {
      bankAccountId: options.bankAccountId,
      status: options.status,
      startDate: options.startDate,
      endDate: options.endDate,
    },
    { enabled: !!currentCompany?.id }
  );

  const createTransactionMutation =
    trpc.cashBank.createTransaction.useMutation({
      onSuccess: () => refetch(),
    });

  const createTransaction = useCallback(
    async (data: CreateCashTransactionInput) => {
      return apiAction(
        () => createTransactionMutation.mutateAsync(data),
        'Transaction created successfully!'
      );
    },
    [createTransactionMutation]
  );

  const postTransactionMutation =
    trpc.cashBank.postTransaction.useMutation({
      onSuccess: () => {
        refetch();
        utils.cashBank.listAccounts.invalidate(); // Update balances
      },
    });

  const postTransaction = useCallback(
    async (id: string) => {
      const confirmed = await confirm({
        title: 'Post Transaction',
        message:
          'This will post the transaction to the ledger. Continue?',
        confirmText: 'Post',
      });

      if (!confirmed) return;

      return apiAction(
        () => postTransactionMutation.mutateAsync(id),
        'Transaction posted successfully!'
      );
    },
    [confirm, postTransactionMutation, utils.cashBank.listAccounts]
  );

  const voidTransactionMutation =
    trpc.cashBank.voidTransaction.useMutation({
      onSuccess: () => {
        refetch();
        utils.cashBank.listAccounts.invalidate();
      },
    });

  const voidTransaction = useCallback(
    async (id: string, reason: string) => {
      const confirmed = await confirm({
        title: 'Void Transaction',
        message: 'Are you sure you want to void this transaction?',
        confirmText: 'Void',
        variant: 'danger',
      });

      if (!confirmed) return;

      return apiAction(
        () => voidTransactionMutation.mutateAsync({ id, reason }),
        'Transaction voided successfully!'
      );
    },
    [confirm, voidTransactionMutation, utils.cashBank.listAccounts]
  );

  return {
    transactions: transactions || [],
    loading,
    refresh: refetch,
    createTransaction,
    postTransaction,
    voidTransaction,
    isCreating: createTransactionMutation.isPending,
    isPosting: postTransactionMutation.isPending,
    isVoiding: voidTransactionMutation.isPending,
  };
}
