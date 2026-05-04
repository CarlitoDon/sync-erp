/**
 * Partner Tools
 */
import type { ToolSpec } from '../types.js';
import { apiQuery, apiMutation } from '../client.js';
import {
  getString,
  getOptionalString,
  companyIdProp,
  idProp,
  buildInput,
} from './_helpers.js';

export function getPartnerTools(): ToolSpec[] {
  return [
    {
      name: 'partner_list',
      description: 'List partners (customers/suppliers) for a company',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          type: {
            type: 'string',
            enum: ['CUSTOMER', 'SUPPLIER', 'BOTH'],
            description: 'Filter by partner type',
          },
        },
        required: ['companyId'],
      },
      handler: async (args) => {
        const companyId = getString(args, 'companyId');
        const type = getOptionalString(args, 'type');
        return apiQuery('partner.list', buildInput([['type', type]]), companyId);
      },
    },
    {
      name: 'partner_get',
      description: 'Get partner details by ID',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiQuery(
          'partner.getById',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'partner_create',
      description: 'Create a new partner (customer/supplier)',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          name: { type: 'string', description: 'Partner name' },
          type: {
            type: 'string',
            enum: ['CUSTOMER', 'SUPPLIER', 'BOTH'],
          },
          email: { type: 'string', description: 'Email address' },
          phone: { type: 'string', description: 'Phone number' },
          address: { type: 'string', description: 'Address' },
        },
        required: ['companyId', 'name', 'type'],
      },
      handler: async (args) => {
        const companyId = getString(args, 'companyId');
        const { companyId: _, ...input } = args;
        return apiMutation('partner.create', input, companyId);
      },
    },
    {
      name: 'partner_update',
      description: 'Update an existing partner',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          id: idProp,
          data: {
            type: 'object',
            description: 'Fields to update (name, email, phone, address, type)',
            properties: {},
          },
        },
        required: ['companyId', 'id', 'data'],
      },
      handler: async (args) => {
        const companyId = getString(args, 'companyId');
        const id = getString(args, 'id');
        const data = args.data as Record<string, unknown>;
        return apiMutation('partner.update', { id, data }, companyId);
      },
    },
    {
      name: 'partner_delete',
      description: 'Delete a partner',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation(
          'partner.delete',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
  ];
}
