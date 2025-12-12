import api from '../../../services/api';
import { Payment } from '@sync-erp/shared';

export const paymentService = {
  getPaymentHistory: async (
    invoiceId: string
  ): Promise<Payment[]> => {
    const response = await api.get(`/payments/invoice/${invoiceId}`);
    return response.data;
  },
};
