/**
 * User Tools
 */
import type { ToolSpec } from '../types.js';
import { apiQuery } from '../client.js';
import { getString, companyIdProp, idProp } from './_helpers.js';

export function getUserTools(): ToolSpec[] {
  return [
    {
      name: 'user_list',
      description: 'List users belonging to a company',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery('user.listByCompany', {}, getString(args, 'companyId')),
    },
    {
      name: 'user_get',
      description: 'Get user details by ID',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiQuery(
          'user.getById',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
  ];
}
