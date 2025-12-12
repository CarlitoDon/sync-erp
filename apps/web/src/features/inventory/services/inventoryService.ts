import api from '../../../services/api';
import {
  GoodsReceiptInput,
  StockAdjustmentInput,
  InventoryMovement,
} from '@sync-erp/shared';

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
  return response.data.data;
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
  return response.data.data;
};
