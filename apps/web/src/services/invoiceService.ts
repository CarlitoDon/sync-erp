import api from './api';
import type { Partner } from './partnerService';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  partnerId: string;
  partner?: Partner;
  type: 'INVOICE' | 'BILL';
  status: 'DRAFT' | 'POSTED' | 'PAID' | 'VOID';
  amount: number;
  balance: number;
  dueDate: string;
  createdAt: string;
  payments?: Payment[];
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: string;
  date: string;
}

export interface CreateInvoiceInput {
  orderId: string;
  invoiceNumber?: string;
  dueDate?: string;
  taxRate?: number;
}

export interface CreatePaymentInput {
  invoiceId: string;
  amount: number;
  method: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'CREDIT_CARD' | 'OTHER';
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
