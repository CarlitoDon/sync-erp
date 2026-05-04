import type { ToolSpec } from '../types.js';
import { apiQuery, apiMutation } from '../client.js';
import { getString, getOptionalBoolean, companyIdProp, idProp, buildInput } from './_helpers.js';

export function getPaymentMethodTools(): ToolSpec[] {
  return [
    {
      name: 'payment_method_list',
      description: 'List payment methods for a company',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, includeInactive: { type: 'boolean' } },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery('paymentMethod.list', buildInput([['includeInactive', getOptionalBoolean(args, 'includeInactive')]]), getString(args, 'companyId')),
    },
    {
      name: 'payment_method_get',
      description: 'Get payment method by ID',
      inputSchema: { type: 'object', properties: { companyId: companyIdProp, id: idProp }, required: ['companyId', 'id'] },
      handler: async (args) =>
        apiQuery('paymentMethod.getById', { id: getString(args, 'id') }, getString(args, 'companyId')),
    },
    {
      name: 'payment_method_create',
      description: 'Create payment method. Input JSON: {code, name, type (CASH|BANK|QRIS|EWALLET|OTHER), accountId?, isDefault?}',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, input: { type: 'string', description: 'JSON fields' } },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation('paymentMethod.create', input as Record<string, unknown>, getString(args, 'companyId'));
      },
    },
    {
      name: 'payment_method_update',
      description: 'Update payment method. Input JSON: {id, data: {code?, name?, type?, isActive?}}',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, input: { type: 'string', description: 'JSON: {id, data}' } },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation('paymentMethod.update', input as Record<string, unknown>, getString(args, 'companyId'));
      },
    },
    {
      name: 'payment_method_delete',
      description: 'Delete a payment method',
      inputSchema: { type: 'object', properties: { companyId: companyIdProp, id: idProp }, required: ['companyId', 'id'] },
      handler: async (args) =>
        apiMutation('paymentMethod.delete', { id: getString(args, 'id') }, getString(args, 'companyId')),
    },
    {
      name: 'payment_method_seed',
      description: 'Seed default payment methods for a company',
      inputSchema: { type: 'object', properties: { companyId: companyIdProp }, required: ['companyId'] },
      handler: async (args) =>
        apiMutation('paymentMethod.seedDefaults', {}, getString(args, 'companyId')),
    },
  ];
}
