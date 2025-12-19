import api from '@/services/api';
import { ensureArray } from '@/utils/safeData';
import {
  GoodsReceiptInput,
  StockAdjustmentInput,
  InventoryMovement,
  CreateGoodsReceiptInput,
  CreateShipmentInput,
  GoodsReceiptResponse,
  GoodsReceiptItemResponse,
  ShipmentResponse,
  ShipmentItemResponse,
} from '@sync-erp/shared';

// Re-export types for convenience
export type {
  CreateGoodsReceiptInput,
  CreateShipmentInput,
  GoodsReceiptResponse,
  GoodsReceiptItemResponse,
  ShipmentResponse,
  ShipmentItemResponse,
};

// ==========================================
// Goods Receipt API (034-grn-fullstack)
// ==========================================

export const createGoodsReceipt = async (
  companyId: string,
  data: CreateGoodsReceiptInput
): Promise<GoodsReceiptResponse> => {
  const response = await api.post<{
    success: boolean;
    data: GoodsReceiptResponse;
  }>('/inventory/receipts', data, {
    headers: { 'x-company-id': companyId },
  });
  return response.data?.data ?? response.data;
};

export const listGoodsReceipts = async (
  companyId: string
): Promise<GoodsReceiptResponse[]> => {
  const response = await api.get<{
    success: boolean;
    data: GoodsReceiptResponse[];
  }>('/inventory/receipts', {
    headers: { 'x-company-id': companyId },
  });
  return ensureArray(response.data?.data);
};

export const getGoodsReceipt = async (
  companyId: string,
  id: string
): Promise<GoodsReceiptResponse | null> => {
  const response = await api.get<{
    success: boolean;
    data: GoodsReceiptResponse;
  }>(`/inventory/receipts/${id}`, {
    headers: { 'x-company-id': companyId },
  });
  return response.data?.data ?? null;
};

export const postGoodsReceipt = async (
  companyId: string,
  id: string
): Promise<GoodsReceiptResponse> => {
  const response = await api.post<{
    success: boolean;
    data: GoodsReceiptResponse;
  }>(
    `/inventory/receipts/${id}/post`,
    {},
    {
      headers: { 'x-company-id': companyId },
    }
  );
  return response.data?.data ?? response.data;
};

// ==========================================
// Shipment API (034-grn-fullstack)
// ==========================================

export const createShipment = async (
  companyId: string,
  data: CreateShipmentInput
): Promise<ShipmentResponse> => {
  const response = await api.post<{
    success: boolean;
    data: ShipmentResponse;
  }>('/inventory/shipments', data, {
    headers: { 'x-company-id': companyId },
  });
  return response.data?.data ?? response.data;
};

export const listShipments = async (
  companyId: string
): Promise<ShipmentResponse[]> => {
  const response = await api.get<{
    success: boolean;
    data: ShipmentResponse[];
  }>('/inventory/shipments', {
    headers: { 'x-company-id': companyId },
  });
  return ensureArray(response.data?.data);
};

export const getShipment = async (
  companyId: string,
  id: string
): Promise<ShipmentResponse | null> => {
  const response = await api.get<{
    success: boolean;
    data: ShipmentResponse;
  }>(`/inventory/shipments/${id}`, {
    headers: { 'x-company-id': companyId },
  });
  return response.data?.data ?? null;
};

export const postShipment = async (
  companyId: string,
  id: string
): Promise<ShipmentResponse> => {
  const response = await api.post<{
    success: boolean;
    data: ShipmentResponse;
  }>(
    `/inventory/shipments/${id}/post`,
    {},
    {
      headers: { 'x-company-id': companyId },
    }
  );
  return response.data?.data ?? response.data;
};

// ==========================================
// Legacy APIs (kept for compatibility)
// ==========================================

/** @deprecated Use createGoodsReceipt + postGoodsReceipt instead */
export const processGoodsReceipt = async (
  companyId: string,
  data: GoodsReceiptInput
): Promise<InventoryMovement[]> => {
  const response = await api.post<{
    success: boolean;
    data: InventoryMovement[];
  }>('/inventory/goods-receipt', data, {
    headers: { 'x-company-id': companyId },
  });
  return ensureArray(response.data?.data);
};

export const adjustStock = async (
  companyId: string,
  data: StockAdjustmentInput
): Promise<InventoryMovement> => {
  const response = await api.post<{
    success: boolean;
    data: InventoryMovement;
  }>('/inventory/adjust', data, {
    headers: { 'x-company-id': companyId },
  });
  return response.data?.data ?? response.data;
};

export const getMovements = async (
  productId?: string
): Promise<InventoryMovement[]> => {
  const params = productId ? { productId } : {};
  const response = await api.get<{
    success: boolean;
    data: InventoryMovement[];
  }>('/inventory/movements', { params });
  return ensureArray(response.data?.data);
};
