import api from '@/services/api';
import { CreatePaymentInput } from '@sync-erp/shared';

export interface Payment {
  id: string;
  companyId: string;
  invoiceId: string;
  amount: number;
  method: string;
  date: Date;
  reference?: string;
  createdAt: Date;
  invoice?: {
    id: string;
    invoiceNumber: string;
    partner: {
      name: string;
    };
  };
}

export const paymentService = {
  create: async (
    companyId: string,
    data: CreatePaymentInput
  ): Promise<Payment> => {
    const response = await api.post<{
      success: boolean;
      data: Payment;
    }>('/payments', data, {
      headers: { 'x-company-id': companyId },
    });
    return response.data?.data ?? response.data;
  },

  list: async (
    companyId: string,
    invoiceId?: string
  ): Promise<Payment[]> => {
    const response = await api.get<{
      success: boolean;
      data: Payment[];
    }>('/payments', {
      params: { invoiceId },
      headers: { 'x-company-id': companyId },
    });
    return response.data?.data ?? [];
  },

  getById: async (
    companyId: string,
    id: string
  ): Promise<Payment | null> => {
    const response = await api.get<{
      success: boolean;
      data: Payment;
    }>(`/payments/${id}`, {
      headers: { 'x-company-id': companyId },
    });
    return response.data?.data ?? null;
  },
};
