import api from './api'; // Axios instance
import {
  RegisterPayload,
  LoginPayload,
  AuthResponse,
  User,
} from '@sync-erp/shared';

// We can re-export types from here for UI usage
export type { RegisterPayload, LoginPayload, AuthResponse };

export const authService = {
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>(
      '/auth/register',
      payload
    );
    return response.data;
  },

  // Stub for logic elsewhere
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>(
      '/auth/login',
      payload
    );
    return response.data;
  },

  async logout() {
    await api.post('/auth/logout');
  },

  async getMe(): Promise<User> {
    const response = await api.get<{ success: boolean; data: User }>(
      '/auth/me'
    );
    return response.data.data;
  },
};
