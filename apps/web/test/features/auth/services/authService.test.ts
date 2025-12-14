import { authService } from '../../../../src/features/auth/services/authService';
import api from '../../../../src/services/api';
import { LoginPayload, RegisterPayload } from '@sync-erp/shared';

// Mock api module
vi.mock('../../../../src/services/api', async () => {
  const { mockApi } = await vi.importActual<any>(
    '../mocks/services.mock'
  );
  return { default: mockApi };
});

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call register endpoint', async () => {
    const payload: RegisterPayload = {
      email: 'test@test.com',
      password: '123',
      name: 'Test',
    };
    const mockResponse = {
      data: {
        token: 'abc',
        user: { id: '1', email: 'test@test.com' },
      },
    };

    (api.post as any).mockResolvedValue(mockResponse);

    const result = await authService.register(payload);

    expect(api.post).toHaveBeenCalledWith('/auth/register', payload);
    expect(result).toEqual(mockResponse.data);
  });

  it('should call login endpoint', async () => {
    const payload: LoginPayload = {
      email: 'test@test.com',
      password: '123',
    };
    const mockResponse = {
      data: { token: 'abc', user: { id: '1' } },
    };

    (api.post as any).mockResolvedValue(mockResponse);

    const result = await authService.login(payload);

    expect(api.post).toHaveBeenCalledWith('/auth/login', payload);
    expect(result).toEqual(mockResponse.data);
  });

  it('should call logout endpoint', async () => {
    (api.post as any).mockResolvedValue({});

    await authService.logout();

    expect(api.post).toHaveBeenCalledWith('/auth/logout');
  });

  it('should call getMe endpoint', async () => {
    const mockUser = { id: '1', email: 'me@test.com' };
    // API returns { success: boolean, data: User } structure based on code
    const mockResponse = { data: { success: true, data: mockUser } };

    (api.get as any).mockResolvedValue(mockResponse);

    const result = await authService.getMe();

    expect(api.get).toHaveBeenCalledWith('/auth/me');
    expect(result).toEqual(mockUser);
  });
});
