import api from './api';

export interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  averageCost: number;
  stockQty: number;
  createdAt: string;
}

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
    const res = await api.get('/api/products');
    return res.data.data;
  },

  async getById(id: string): Promise<Product> {
    const res = await api.get(`/api/products/${id}`);
    return res.data.data;
  },

  async create(data: CreateProductInput): Promise<Product> {
    const res = await api.post('/api/products', data);
    return res.data.data;
  },

  async update(id: string, data: Partial<CreateProductInput>): Promise<Product> {
    const res = await api.put(`/api/products/${id}`, data);
    return res.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/products/${id}`);
  },

  async getStockLevels(): Promise<StockLevel[]> {
    const res = await api.get('/api/inventory/stock');
    return res.data.data;
  },
};
