import api from '@/services/api';
import { ensureArray } from '@/utils/safeData';

import type { Invoice as Bill } from '@sync-erp/shared';
export type { Bill };

export interface CreateBillInput {
  orderId: string;
  invoiceNumber?: string;
  dueDate?: string;
}

export const billService = {
  async list(
    filters: {
      status?: string;
      partnerId?: string;
      orderId?: string;
    } = {}
  ): Promise<Bill[]> {
    const params = { ...filters };
    const res = await api.get('/bills', { params });
    return ensureArray(res.data?.data);
  },

  async getOutstanding(): Promise<Bill[]> {
    const res = await api.get('/bills/outstanding');
    return ensureArray(res.data?.data);
  },

  async getById(id: string): Promise<Bill> {
    const res = await api.get(`/bills/${id}`);
    return res.data?.data ?? res.data;
  },

  async create(data: CreateBillInput): Promise<Bill> {
    const res = await api.post('/bills', data);
    return res.data?.data ?? res.data;
  },

  async post(id: string): Promise<Bill> {
    const res = await api.post(`/bills/${id}/post`);
    return res.data?.data ?? res.data;
  },

  async void(id: string): Promise<Bill> {
    const res = await api.post(`/bills/${id}/void`);
    return res.data?.data ?? res.data;
  },

  async getRemainingAmount(id: string): Promise<number> {
    const res = await api.get(`/bills/${id}/remaining`);
    return res.data?.data?.remaining ?? 0;
  },

  async createFromPO(orderId: string): Promise<Bill> {
    const res = await api.post('/bills', { orderId });
    return res.data?.data ?? res.data;
  },

  async getByOrderId(orderId: string): Promise<Bill | null> {
    try {
      const res = await api.get(`/bills/by-order/${orderId}`);
      return res.data?.data ?? null;
    } catch {
      // 404 means no bill exists for this order
      return null;
    }
  },
};
