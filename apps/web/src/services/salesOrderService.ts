import api from './api';
import type { Partner } from './partnerService';
import type { Product } from './productService';

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
  createdAt: string;
}

export interface CreateSalesOrderInput {
  partnerId: string;
  items: { productId: string; quantity: number; price: number }[];
}

export const salesOrderService = {
  async list(status?: string): Promise<SalesOrder[]> {
    const params = status ? { status } : {};
    const res = await api.get('/sales-orders', { params });
    return res.data.data;
  },

  async getById(id: string): Promise<SalesOrder> {
    const res = await api.get(`/sales-orders/${id}`);
    return res.data.data;
  },

  async create(data: CreateSalesOrderInput): Promise<SalesOrder> {
    const res = await api.post('/sales-orders', data);
    return res.data.data;
  },

  async confirm(id: string): Promise<SalesOrder> {
    const res = await api.post(`/sales-orders/${id}/confirm`);
    return res.data.data;
  },

  async ship(id: string, reference?: string): Promise<void> {
    await api.post(`/sales-orders/${id}/ship`, { reference });
  },

  async cancel(id: string): Promise<SalesOrder> {
    const res = await api.post(`/sales-orders/${id}/cancel`);
    return res.data.data;
  },
};
