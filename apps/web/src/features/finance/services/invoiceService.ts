import api from '../../../services/api';
import { ensureArray } from '../../../utils/safeData';

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
  date?: string; // Business date (FR-005a)
}

export const invoiceService = {
  async list(
    filters: {
      status?: string;
      partnerId?: string;
      orderId?: string;
    } = {}
  ): Promise<Invoice[]> {
    const params = { ...filters };
    const res = await api.get('/invoices', { params });
    return ensureArray(res.data?.data);
  },

  async getOutstanding(): Promise<Invoice[]> {
    const res = await api.get('/invoices/outstanding');
    return ensureArray(res.data?.data);
  },

  async getById(id: string): Promise<Invoice> {
    const res = await api.get(`/invoices/${id}`);
    return res.data?.data ?? res.data;
  },

  async create(data: CreateInvoiceInput): Promise<Invoice> {
    const res = await api.post('/invoices', data);
    return res.data?.data ?? res.data;
  },

  async post(id: string): Promise<Invoice> {
    const res = await api.post(`/invoices/${id}/post`);
    return res.data?.data ?? res.data;
  },

  async void(id: string): Promise<Invoice> {
    const res = await api.post(`/invoices/${id}/void`);
    return res.data?.data ?? res.data;
  },

  async getRemainingAmount(id: string): Promise<number> {
    const res = await api.get(`/invoices/${id}/remaining`);
    return res.data?.data?.remaining ?? 0;
  },

  // Check if Sales Order already has an invoice
  async getByOrderId(orderId: string): Promise<Invoice | null> {
    try {
      const res = await api.get(`/invoices/by-order/${orderId}`);
      return res.data?.data ?? null;
    } catch {
      return null;
    }
  },

  // Create invoice from Sales Order
  async createFromSO(orderId: string): Promise<Invoice> {
    const res = await api.post('/invoices', { orderId });
    return res.data?.data ?? res.data;
  },
};

export const paymentService = {
  async list(invoiceId?: string): Promise<Payment[]> {
    const params = invoiceId ? { invoiceId } : {};
    const res = await api.get('/payments', { params });
    return ensureArray(res.data?.data);
  },

  async create(data: CreatePaymentInput): Promise<Payment> {
    const res = await api.post('/payments', data);
    return res.data?.data ?? res.data;
  },

  async getForInvoice(invoiceId: string): Promise<Payment[]> {
    const res = await api.get(`/payments/invoice/${invoiceId}`);
    return ensureArray(res.data?.data);
  },
};
