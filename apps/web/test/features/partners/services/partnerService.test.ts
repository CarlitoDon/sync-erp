import { partnerService } from '../../../../src/features/partners/services/partnerService';
import api from '../../../../src/services/api';

// Mock the api module
vi.mock('../../../../src/services/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { data: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { data: {} } })),
    put: vi.fn(() => Promise.resolve({ data: { data: {} } })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

describe('partnerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should request /partners/suppliers without /api prefix', async () => {
    await partnerService.listSuppliers();
    expect(api.get).toHaveBeenCalledWith('/partners/suppliers');
    expect(api.get).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\//)
    );
  });

  it('should request /partners/customers without /api prefix', async () => {
    await partnerService.listCustomers();
    expect(api.get).toHaveBeenCalledWith('/partners/customers');
    expect(api.get).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\//)
    );
  });

  it('should request /partners/${id} without /api prefix', async () => {
    const id = '123';
    await partnerService.getById(id);
    expect(api.get).toHaveBeenCalledWith(`/partners/${id}`);
    expect(api.get).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\//)
    );
  });
});
