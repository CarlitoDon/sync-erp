import api from '../../../services/api';
import {
  User,
  CompanyMember,
  InviteUserInput,
  AssignRoleSchema, // We can use the Schema to infer input if needed, or just type manual
} from '@sync-erp/shared';
import { z } from 'zod';

export type AssignUserPayload = z.infer<typeof AssignRoleSchema>;

export const userService = {
  listByCompany: async (
    companyId: string
  ): Promise<(User & { roles: CompanyMember[] })[]> => {
    const response = await api.get(`/companies/${companyId}/users`);
    return response.data;
  },

  invite: async (companyId: string, payload: InviteUserInput) => {
    const response = await api.post(
      `/companies/${companyId}/invites`,
      payload
    );
    return response.data;
  },

  assign: async (companyId: string, payload: AssignUserPayload) => {
    const response = await api.post(
      `/companies/${companyId}/users/${payload.userId}/assign`,
      {
        roleId: payload.roleId,
      }
    );
    return response.data;
  },
};
