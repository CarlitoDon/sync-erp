import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import {
  paymentService,
  Payment,
} from '@/features/accounting/services/paymentService';
import { CreatePaymentInput } from '@sync-erp/shared';

export function usePayment() {
  const { currentCompany } = useCompany();

  const createPayment = async (
    data: CreatePaymentInput
  ): Promise<Payment | null> => {
    if (!currentCompany) return null;

    const result = await apiAction(
      () => paymentService.create(currentCompany.id, data),
      'Payment recorded successfully!'
    );

    return result ?? null;
  };

  const getPayments = async (
    invoiceId?: string
  ): Promise<Payment[]> => {
    if (!currentCompany) return [];

    try {
      return await paymentService.list(currentCompany.id, invoiceId);
    } catch (error) {
      console.error('Failed to load payments:', error);
      return [];
    }
  };

  const getPayment = async (id: string): Promise<Payment | null> => {
    if (!currentCompany) return null;

    try {
      return await paymentService.getById(currentCompany.id, id);
    } catch (error) {
      console.error('Failed to load payment:', error);
      return null;
    }
  };

  return {
    createPayment,
    getPayments,
    getPayment,
  };
}
