import * as companyService from '../../../../src/features/company/services/companyService';
import api from '../../../../src/services/api';
import { CreateCompanyDto, JoinCompanyDto } from '@sync-erp/shared';

// Mock api
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

describe('companyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get companies', async () => {
    const mockData = [{ id: '1', name: 'Company A' }];
    (api.get as any).mockResolvedValue({
      data: { success: true, data: mockData },
    });

    const result = await companyService.getCompanies();

    expect(api.get).toHaveBeenCalledWith('/companies');
    expect(result).toEqual(mockData);
  });

  it('should get company by id', async () => {
    const mockData = { id: '1', name: 'Company A' };
    (api.get as any).mockResolvedValue({
      data: { success: true, data: mockData },
    });

    const result = await companyService.getCompanyById('1');

    expect(api.get).toHaveBeenCalledWith('/companies/1');
    expect(result).toEqual(mockData);
  });

  it('should create company', async () => {
    const dto: CreateCompanyDto = { name: 'New Company' };
    const mockData = { id: '2', name: 'New Company' };
    (api.post as any).mockResolvedValue({
      data: { success: true, data: mockData },
    });

    const result = await companyService.createCompany(dto);

    expect(api.post).toHaveBeenCalledWith('/companies', dto);
    expect(result).toEqual(mockData);
  });

  it('should join company', async () => {
    const dto: JoinCompanyDto = { inviteCode: 'ABC' };
    const mockData = { id: '1', name: 'Joined Company' };
    (api.post as any).mockResolvedValue({
      data: { success: true, data: mockData },
    });

    const result = await companyService.joinCompany(dto);

    expect(api.post).toHaveBeenCalledWith('/companies/join', dto);
    expect(result).toEqual(mockData);
  });
});
