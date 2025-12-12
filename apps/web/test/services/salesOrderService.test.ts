import { salesOrderService, CreateSalesOrderInput } from '../../src/services/salesOrderService';
import api from '../../src/services/api';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/services/api', async () => {
  const { mockApi } = await vi.importActual<any>('../mocks/services.mock');
  return { default: mockApi };
});

describe('salesOrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list sales orders', async () => {
    const mockData = [{ id: '1' }];
    (api.get as any).mockResolvedValue({ data: { data: mockData } });

    const result = await salesOrderService.list();

    expect(api.get).toHaveBeenCalledWith('/sales-orders', { params: {} });
    expect(result).toEqual(mockData);
  });

  it('should create sales order', async () => {
    const dto: CreateSalesOrderInput = { partnerId: '1', items: [] };
    const mockData = { id: 'so_1' };
    (api.post as any).mockResolvedValue({ data: { data: mockData } });

    const result = await salesOrderService.create(dto);

    expect(api.post).toHaveBeenCalledWith('/sales-orders', dto);
    expect(result).toEqual(mockData);
  });

  it('should ship sales order', async () => {
    (api.post as any).mockResolvedValue({});

    await salesOrderService.ship('so_1', 'TRACK123');

    expect(api.post).toHaveBeenCalledWith('/sales-orders/so_1/ship', { reference: 'TRACK123' });
  });

  it('should cancel sales order', async () => {
    const mockData = { id: 'so_1', status: 'CANCELLED' };
    (api.post as any).mockResolvedValue({ data: { data: mockData } });

    const result = await salesOrderService.cancel('so_1');

    expect(api.post).toHaveBeenCalledWith('/sales-orders/so_1/cancel');
    expect(result).toEqual(mockData);
  });
});
