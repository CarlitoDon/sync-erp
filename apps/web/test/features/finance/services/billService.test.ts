import {
  billService,
  CreateBillInput,
} from '../../../../src/features/finance/services/billService';
import api from '../../../../src/services/api';

vi.mock('../../../../src/services/api', async () => {
  const { mockApi } = await vi.importActual<any>(
    '../mocks/services.mock'
  );
  return { default: mockApi };
});

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

    const result = await billService.list('DRAFT');

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
