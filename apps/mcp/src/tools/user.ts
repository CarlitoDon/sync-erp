/**
 * User Tools
 */
import type { ToolSpec } from '../types.js';
<<<<<<< HEAD
import { apiQuery } from '../client.js';
=======
import { apiQuery, apiMutation } from '../client.js';
>>>>>>> origin/dev
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
<<<<<<< HEAD
=======
    {
      name: 'user_create',
      description: 'Create a new user. Input JSON: {name, email, password, roleId?}',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: {
            type: 'string',
            description: 'JSON: {name, email, password, roleId?}',
          },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'user.create',
          input as Record<string, unknown>,
          getString(args, 'companyId')
        );
      },
    },
>>>>>>> origin/dev
  ];
}
