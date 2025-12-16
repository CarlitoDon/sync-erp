import {
  productService,
  CreateProductInput,
} from '../../../../src/features/inventory/services/productService';
import api from '../../../../src/services/api';

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

vi.mock('../../../../src/services/api', () => ({
  default: mockApi,
}));

describe('productService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list products', async () => {
    const mockData = [{ id: '1' }];
    (api.get as any).mockResolvedValue({ data: { data: mockData } });

    const result = await productService.list();

    expect(api.get).toHaveBeenCalledWith('/products');
    expect(result).toEqual(mockData);
  });

  it('should create product', async () => {
    const dto: CreateProductInput = {
      sku: 'SKU1',
      name: 'Product 1',
      price: 100,
    };
    const mockData = { id: '1', ...dto };
    (api.post as any).mockResolvedValue({ data: { data: mockData } });

    const result = await productService.create(dto);

    expect(api.post).toHaveBeenCalledWith('/products', dto);
    expect(result).toEqual(mockData);
  });

  it('should update product', async () => {
    const dto = { price: 200 };
    const mockData = { id: '1', price: 200 };
    (api.put as any).mockResolvedValue({ data: { data: mockData } });

    const result = await productService.update('1', dto);

    expect(api.put).toHaveBeenCalledWith('/products/1', dto);
    expect(result).toEqual(mockData);
  });

  it('should delete product', async () => {
    (api.delete as any).mockResolvedValue({});

    await productService.delete('1');

    expect(api.delete).toHaveBeenCalledWith('/products/1');
  });

  it('should get stock levels', async () => {
    const mockData = [{ sku: 'SKU1', stockQty: 10 }];
    (api.get as any).mockResolvedValue({ data: { data: mockData } });

    const result = await productService.getStockLevels();

    expect(api.get).toHaveBeenCalledWith('/inventory/stock');
    expect(result).toEqual(mockData);
  });
});
