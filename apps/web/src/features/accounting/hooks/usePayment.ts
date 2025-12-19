import { useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { trpc } from '@/lib/trpc';

export function usePayment() {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  // List payments using tRPC
  const {
    data: payments,
    isLoading: loading,
    refetch: loadData,
  } = trpc.payment.list.useQuery(undefined, {
    enabled: !!currentCompany?.id,
  });

  // Get payment by ID
  const getPayment = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return undefined;
      const payment = await utils.payment.getById.fetch({ id });
      return payment || undefined;
    },
    [currentCompany?.id, utils]
  );

  // Create payment
  const createPaymentMutation = trpc.payment.create.useMutation({
    onSuccess: () => {
      loadData();
    },
  });

  const createPayment = useCallback(
    async (data: any) => {
      if (!currentCompany?.id) return null;

      const result = await apiAction(
        async () => createPaymentMutation.mutateAsync(data),
        'Payment created successfully'
      );

      return result;
    },
    [currentCompany?.id, createPaymentMutation]
  );

  return {
    payments: payments || [],
    loading,
    loadData,
    getPayment,
    createPayment,
  };
}

export default usePayment;
