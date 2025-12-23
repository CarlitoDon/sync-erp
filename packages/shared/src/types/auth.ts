import { User } from '../generated/zod/index.js';

export interface RegisterPayload {
  email: string;
  name: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

// Ensure User type from index.js is compatible or extend it if needed
// Actually, I should probably define AuthUser or rely on User
// But types/index.ts has a User interface.

export interface AuthResponse {
  success: boolean;
  data?: User;
  error?: {
    code: string;
    message: string;
  };
}
