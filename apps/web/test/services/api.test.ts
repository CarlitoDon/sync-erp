import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
} from 'vitest';
import { HEADERS } from '@sync-erp/shared';
// We mock axios first
const { requestUse, responseUse, mockAxiosInstance } = vi.hoisted(
  () => {
    const requestUse = vi.fn();
    const responseUse = vi.fn();
    const mockAxiosInstance = {
      interceptors: {
        request: { use: requestUse },
        response: { use: responseUse },
      },
      defaults: { headers: { common: {} } },
      get: vi.fn(),
    };
    return { requestUse, responseUse, mockAxiosInstance };
  }
);

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
  },
}));

import '../../src/services/api';
import toast from 'react-hot-toast';

describe('api service', () => {
  let requestInterceptor: any;
  let responseSuccessHandler: any;
  let responseErrorHandler: any;

  beforeAll(() => {
    // Capture interceptors from initial mock calls
    if (requestUse.mock.calls.length > 0) {
      requestInterceptor = requestUse.mock.calls[0][0];
    }
    if (responseUse.mock.calls.length > 0) {
      responseSuccessHandler = responseUse.mock.calls[0][0];
      responseErrorHandler = responseUse.mock.calls[0][1];
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Request Interceptor', () => {
    it('should add company and user headers if present in localStorage', () => {
      localStorage.setItem('currentCompanyId', '123');
      localStorage.setItem('currentUserId', '456');

      const config = { headers: {} };
      const result = requestInterceptor(config);

      expect(result.headers[HEADERS.COMPANY_ID]).toBe('123');
      expect(result.headers[HEADERS.USER_ID]).toBe('456');
    });

    it('should not add headers if missing', () => {
      const config = { headers: {} };
      const result = requestInterceptor(config);

      expect(result.headers[HEADERS.COMPANY_ID]).toBeUndefined();
      expect(result.headers[HEADERS.USER_ID]).toBeUndefined();
    });
  });

  describe('Response Interceptor', () => {
    it('should return response on success', async () => {
      const response = { data: 'ok' };
      expect(responseSuccessHandler(response)).toBe(response);
    });

    it('should handle error and show toast', async () => {
      const error = {
        response: {
          data: {
            error: { message: 'Custom Error' },
          },
          status: 400,
        },
      };

      try {
        await responseErrorHandler(error);
      } catch (e) {
        expect(e).toBe(error);
      }

      expect(toast.error).toHaveBeenCalledWith('Custom Error');
    });

    it('should handle 401 error', async () => {
      const error = {
        response: {
          status: 401,
        },
      };

      try {
        await responseErrorHandler(error);
      } catch {
        // ignore
      }

      expect(toast.error).toHaveBeenCalledWith(
        'Please login to continue'
      );
    });
  });
});
