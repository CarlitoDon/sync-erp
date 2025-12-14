import api from '../../../services/api';
import {
  User,
  CompanyMember,
  InviteUserInput,
  AssignRoleSchema,
} from '@sync-erp/shared';
import { z } from 'zod';
import { ensureArray } from '../../../utils/safeData';

export type AssignUserPayload = z.infer<typeof AssignRoleSchema>;

export const userService = {
  // Backend uses X-Company-Id header (set by axios interceptor), not path param
  listByCompany: async (): Promise<(User & { roles: CompanyMember[] })[]> => {
    const response = await api.get(`/users`);
    // API returns { success, data } wrapper
    const data = response.data?.data ?? response.data;
    return ensureArray(data);
  },

  invite: async (payload: InviteUserInput) => {
    const response = await api.post(`/users`, payload);
    return response.data?.data ?? response.data;
  },

  assign: async (payload: AssignUserPayload) => {
    const response = await api.post(`/users/${payload.userId}/assign`, {
      roleId: payload.roleId,
    });
    return response.data?.data ?? response.data;
  },
};
