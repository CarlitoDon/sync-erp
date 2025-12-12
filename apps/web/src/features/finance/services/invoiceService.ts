import api from './api';
// Partner type is not used in this file anymore directly

import type { Invoice, Payment } from '@sync-erp/shared';
export type { Invoice, Payment };

export interface CreateInvoiceInput {
  orderId: string;
  invoiceNumber?: string;
  dueDate?: string;
  taxRate?: number;
}

export interface CreatePaymentInput {
  invoiceId: string;
  amount: number;
  method:
    | 'CASH'
    | 'BANK_TRANSFER'
    | 'CHECK'
    | 'CREDIT_CARD'
    | 'OTHER';
}

export const invoiceService = {
  async list(status?: string): Promise<Invoice[]> {
    const params = status ? { status } : {};
    const res = await api.get('/invoices', { params });
    return res.data.data;
  },

  async getOutstanding(): Promise<Invoice[]> {
    const res = await api.get('/invoices/outstanding');
    return res.data.data;
  },

  async getById(id: string): Promise<Invoice> {
    const res = await api.get(`/invoices/${id}`);
    return res.data.data;
  },

  async create(data: CreateInvoiceInput): Promise<Invoice> {
    const res = await api.post('/invoices', data);
    return res.data.data;
  },

  async post(id: string): Promise<Invoice> {
    const res = await api.post(`/invoices/${id}/post`);
    return res.data.data;
  },

  async void(id: string): Promise<Invoice> {
    const res = await api.post(`/invoices/${id}/void`);
    return res.data.data;
  },

  async getRemainingAmount(id: string): Promise<number> {
    const res = await api.get(`/invoices/${id}/remaining`);
    return res.data.data.remaining;
  },
};

export const paymentService = {
  async list(invoiceId?: string): Promise<Payment[]> {
    const params = invoiceId ? { invoiceId } : {};
    const res = await api.get('/payments', { params });
    return res.data.data;
  },

  async create(data: CreatePaymentInput): Promise<Payment> {
    const res = await api.post('/payments', data);
    return res.data.data;
  },

  async getForInvoice(invoiceId: string): Promise<Payment[]> {
    const res = await api.get(`/payments/invoice/${invoiceId}`);
    return res.data.data;
  },
};
