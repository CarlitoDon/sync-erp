import {
  purchaseOrderService,
  CreatePurchaseOrderInput,
} from '../../src/services/purchaseOrderService';
import api from '../../src/services/api';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/services/api', async () => {
  const { mockApi } = await vi.importActual<any>(
    '../mocks/services.mock'
  );
  return { default: mockApi };
});

describe('purchaseOrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list purchase orders', async () => {
    const mockData = [{ id: '1' }];
    (api.get as any).mockResolvedValue({ data: { data: mockData } });

    const result = await purchaseOrderService.list();

    expect(api.get).toHaveBeenCalledWith('/purchase-orders', {
      params: {},
    });
    expect(result).toEqual(mockData);
  });

  it('should create purchase order', async () => {
    const dto: CreatePurchaseOrderInput = {
      partnerId: '1',
      items: [],
    };
    const mockData = { id: 'po_1' };
    (api.post as any).mockResolvedValue({ data: { data: mockData } });

    const result = await purchaseOrderService.create(dto);

    expect(api.post).toHaveBeenCalledWith('/purchase-orders', dto);
    expect(result).toEqual(mockData);
  });

  it('should confirm purchase order', async () => {
    const mockData = { id: 'po_1', status: 'CONFIRMED' };
    (api.post as any).mockResolvedValue({ data: { data: mockData } });

    const result = await purchaseOrderService.confirm('po_1');

    expect(api.post).toHaveBeenCalledWith(
      '/purchase-orders/po_1/confirm'
    );
    expect(result).toEqual(mockData);
  });

  it('should process goods receipt', async () => {
    (api.post as any).mockResolvedValue({});

    await purchaseOrderService.processGoodsReceipt('po_1', 'REF123');

    expect(api.post).toHaveBeenCalledWith(
      '/inventory/goods-receipt',
      {
        orderId: 'po_1',
        reference: 'REF123',
      }
    );
  });
});
