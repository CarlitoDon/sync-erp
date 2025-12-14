import api from '../../../services/api';
import { ensureArray } from '../../../utils/safeData';
import type { Partner } from '../../partners/services/partnerService';
import type { Product } from '../../inventory/services/productService';

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product?: Product;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  partnerId: string;
  partner?: Partner;
  status: 'DRAFT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  totalAmount: number;
  items: OrderItem[];
  createdAt: string;
}

export interface CreatePurchaseOrderInput {
  partnerId: string;
  items: { productId: string; quantity: number; price: number }[];
  taxRate?: number;
}

export const purchaseOrderService = {
  async list(status?: string): Promise<PurchaseOrder[]> {
    const params = status ? { status } : {};
    const res = await api.get('/purchase-orders', { params });
    return ensureArray(res.data?.data);
  },

  async getById(id: string): Promise<PurchaseOrder> {
    const res = await api.get(`/purchase-orders/${id}`);
    return res.data?.data ?? res.data;
  },

  async create(
    data: CreatePurchaseOrderInput
  ): Promise<PurchaseOrder> {
    const res = await api.post('/purchase-orders', data);
    return res.data?.data ?? res.data;
  },

  async confirm(id: string): Promise<PurchaseOrder> {
    const res = await api.post(`/purchase-orders/${id}/confirm`);
    return res.data?.data ?? res.data;
  },

  async cancel(id: string): Promise<PurchaseOrder> {
    const res = await api.post(`/purchase-orders/${id}/cancel`);
    return res.data?.data ?? res.data;
  },

  async processGoodsReceipt(
    orderId: string,
    reference?: string
  ): Promise<void> {
    await api.post('/inventory/goods-receipt', {
      orderId,
      reference,
    });
  },
};
