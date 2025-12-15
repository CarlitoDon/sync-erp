import api from '../../../services/api';
import { ensureArray } from '../../../utils/safeData';
import type { Partner } from '../../partners/services/partnerService';
import type { Product } from '../../inventory/services/productService';
import type { Invoice } from '@sync-erp/shared';

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product?: Product;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  partnerId: string;
  partner?: Partner;
  status: 'DRAFT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  totalAmount: number;
  items: OrderItem[];
  invoices?: Invoice[];
  createdAt: string;
}

export interface CreateSalesOrderInput {
  partnerId: string;
  items: { productId: string; quantity: number; price: number }[];
  taxRate?: number;
}

export const salesOrderService = {
  async list(filters?: { status?: string; partnerId?: string }): Promise<SalesOrder[]> {
    const params = filters || {};
    const res = await api.get('/sales-orders', { params });
    return ensureArray(res.data?.data);
  },

  async getById(id: string): Promise<SalesOrder> {
    const res = await api.get(`/sales-orders/${id}`);
    return res.data?.data ?? res.data;
  },

  async create(data: CreateSalesOrderInput): Promise<SalesOrder> {
    const res = await api.post('/sales-orders', data);
    return res.data?.data ?? res.data;
  },

  async confirm(id: string): Promise<SalesOrder> {
    const res = await api.post(`/sales-orders/${id}/confirm`);
    return res.data?.data ?? res.data;
  },

  async ship(id: string, reference?: string): Promise<void> {
    await api.post(`/sales-orders/${id}/ship`, { reference });
  },

  async cancel(id: string): Promise<SalesOrder> {
    const res = await api.post(`/sales-orders/${id}/cancel`);
    return res.data?.data ?? res.data;
  },
};
