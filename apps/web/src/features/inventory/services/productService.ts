import api from '@/services/api';
import { ensureArray } from '@/utils/safeData';

import type { Product } from '@sync-erp/shared';
export type { Product };

export interface CreateProductInput {
  sku: string;
  name: string;
  price: number;
}

export interface StockLevel {
  id: string;
  sku: string;
  name: string;
  stockQty: number;
  averageCost: number;
  price: number;
}

export const productService = {
  async list(): Promise<Product[]> {
    const res = await api.get('/products');
    return ensureArray(res.data?.data);
  },

  async getById(id: string): Promise<Product> {
    const res = await api.get(`/products/${id}`);
    return res.data?.data ?? res.data;
  },

  async create(data: CreateProductInput): Promise<Product> {
    const res = await api.post('/products', data);
    return res.data?.data ?? res.data;
  },

  async update(
    id: string,
    data: Partial<CreateProductInput>
  ): Promise<Product> {
    const res = await api.put(`/products/${id}`, data);
    return res.data?.data ?? res.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/products/${id}`);
  },

  async getStockLevels(): Promise<StockLevel[]> {
    const res = await api.get('/inventory/stock');
    return ensureArray(res.data?.data);
  },
};
