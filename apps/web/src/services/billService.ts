import api from './api';
// Imports removed

import type { Invoice as Bill } from '@sync-erp/shared';
export type { Bill };

export interface CreateBillInput {
  orderId: string;
  invoiceNumber?: string;
  dueDate?: string;
}

export const billService = {
  async list(status?: string): Promise<Bill[]> {
    const params = status ? { status } : {};
    const res = await api.get('/bills', { params });
    return res.data.data;
  },

  async getOutstanding(): Promise<Bill[]> {
    const res = await api.get('/bills/outstanding');
    return res.data.data;
  },

  async getById(id: string): Promise<Bill> {
    const res = await api.get(`/bills/${id}`);
    return res.data.data;
  },

  async create(data: CreateBillInput): Promise<Bill> {
    const res = await api.post('/bills', data);
    return res.data.data;
  },

  async post(id: string): Promise<Bill> {
    const res = await api.post(`/bills/${id}/post`);
    return res.data.data;
  },

  async void(id: string): Promise<Bill> {
    const res = await api.post(`/bills/${id}/void`);
    return res.data.data;
  },

  async getRemainingAmount(id: string): Promise<number> {
    const res = await api.get(`/bills/${id}/remaining`);
    return res.data.data.remaining;
  },
};
