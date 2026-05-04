/**
 * Company Tools
 */
import type { ToolSpec } from '../types.js';
import { apiQuery } from '../client.js';
import { getString } from './_helpers.js';

export function getCompanyTools(): ToolSpec[] {
  return [
    {
      name: 'company_list',
      description: 'List all companies the authenticated user belongs to',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => apiQuery('company.list'),
    },
    {
      name: 'company_get',
      description: 'Get company details by ID',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Company UUID' },
        },
        required: ['id'],
      },
      handler: async (args) =>
        apiQuery('company.getById', { id: getString(args, 'id') }),
    },
  ];
}
