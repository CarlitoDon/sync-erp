/**
 * Company Tools
 */
import type { ToolSpec } from '../types.js';
import { apiMutation, apiQuery } from '../client.js';
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
    {
      name: 'company_create',
      description: 'Create a new company for the authenticated user',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Company name' },
        },
        required: ['name'],
      },
      handler: async (args) =>
        apiMutation('company.create', { name: getString(args, 'name') }),
    },
    {
      name: 'company_select_shape',
      description:
        'Select the business shape for a company once after creation',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: { type: 'string', description: 'Company UUID' },
          shape: {
            type: 'string',
            enum: ['RETAIL', 'MANUFACTURING', 'SERVICE'],
            description: 'Business shape to activate',
          },
        },
        required: ['companyId', 'shape'],
      },
      handler: async (args) =>
        apiMutation('company.selectShape', {
          companyId: getString(args, 'companyId'),
          shape: getString(args, 'shape'),
        }),
    },
  ];
}
