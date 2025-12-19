import {
  billService,
  CreateBillInput,
} from '@/features/finance/services/billService';
import api from '@/services/api';

const { mockApi } = vi.hoisted(() => {
  return {
    mockApi: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      defaults: { headers: { common: {} } },
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    },
  };
});

vi.mock('@/services/api', () => ({
  default: mockApi,
}));

describe('billService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list bills', async () => {
    const mockData = [{ id: '1' }];
    (api.get as any).mockResolvedValue({ data: { data: mockData } });

    const result = await billService.list();

    expect(api.get).toHaveBeenCalledWith('/bills', { params: {} });
    expect(result).toEqual(mockData);
  });

  it('should list bills with status', async () => {
    const mockData = [{ id: '1' }];
    (api.get as any).mockResolvedValue({ data: { data: mockData } });

    const result = await billService.list({ status: 'DRAFT' });

    expect(api.get).toHaveBeenCalledWith('/bills', {
      params: { status: 'DRAFT' },
    });
    expect(result).toEqual(mockData);
  });

  it('should get outstanding bills', async () => {
    const mockData = [{ id: '1' }];
    (api.get as any).mockResolvedValue({ data: { data: mockData } });

    const result = await billService.getOutstanding();

    expect(api.get).toHaveBeenCalledWith('/bills/outstanding');
    expect(result).toEqual(mockData);
  });

  it('should create bill', async () => {
    const dto: CreateBillInput = { orderId: 'ord_1' };
    const mockData = { id: 'bill_1' };
    (api.post as any).mockResolvedValue({ data: { data: mockData } });

    const result = await billService.create(dto);

    expect(api.post).toHaveBeenCalledWith('/bills', dto);
    expect(result).toEqual(mockData);
  });

  it('should get bill by id', async () => {
    const mockData = { id: 'bill_1' };
    (api.get as any).mockResolvedValue({ data: { data: mockData } });

    const result = await billService.getById('bill_1');

    expect(api.get).toHaveBeenCalledWith('/bills/bill_1');
    expect(result).toEqual(mockData);
  });
});
