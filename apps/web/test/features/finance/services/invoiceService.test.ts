import {
  invoiceService,
  paymentService,
  CreateInvoiceInput,
  CreatePaymentInput,
} from '../../../../src/features/finance/services/invoiceService';
import api from '../../../../src/services/api';

vi.mock('../../../../src/services/api', async () => {
  const { mockApi } = await vi.importActual<any>(
    '../mocks/services.mock'
  );
  return { default: mockApi };
});

describe('invoiceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list invoices', async () => {
    const mockData = [{ id: '1' }];
    (api.get as any).mockResolvedValue({ data: { data: mockData } });

    const result = await invoiceService.list();

    expect(api.get).toHaveBeenCalledWith('/invoices', { params: {} });
    expect(result).toEqual(mockData);
  });

  it('should create invoice', async () => {
    const dto: CreateInvoiceInput = { orderId: '1' };
    const mockData = { id: 'inv_1' };
    (api.post as any).mockResolvedValue({ data: { data: mockData } });

    const result = await invoiceService.create(dto);

    expect(api.post).toHaveBeenCalledWith('/invoices', dto);
    expect(result).toEqual(mockData);
  });
});

describe('paymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list payments for invoice', async () => {
    const mockData = [{ id: 'pay_1' }];
    (api.get as any).mockResolvedValue({ data: { data: mockData } });

    const result = await paymentService.list('inv_1');

    expect(api.get).toHaveBeenCalledWith('/payments', {
      params: { invoiceId: 'inv_1' },
    });
    expect(result).toEqual(mockData);
  });

  it('should create payment', async () => {
    const dto: CreatePaymentInput = {
      invoiceId: 'inv_1',
      amount: 100,
      method: 'CASH',
    };
    const mockData = { id: 'pay_1' };
    (api.post as any).mockResolvedValue({ data: { data: mockData } });

    const result = await paymentService.create(dto);

    expect(api.post).toHaveBeenCalledWith('/payments', dto);
    expect(result).toEqual(mockData);
  });
});
