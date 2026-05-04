/**
 * Payment Tools
 */
import type { ToolSpec } from '../types.js';
import { apiQuery, apiMutation } from '../client.js';
import { getString, companyIdProp, idProp } from './_helpers.js';

export function getPaymentTools(): ToolSpec[] {
  return [
    {
      name: 'payment_list',
      description: 'List all payments for a company',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery('payment.list', {}, getString(args, 'companyId')),
    },
    {
      name: 'payment_get',
      description: 'Get payment details by ID',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiQuery(
          'payment.getById',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'payment_create',
      description:
        'Create a payment. Pass input as JSON string with fields: invoiceId/billId, amount, method, accountId, reference, businessDate',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: {
            type: 'string',
            description:
              'JSON object: {invoiceId?, billId?, amount, method, accountId, reference?, businessDate?}',
          },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'payment.create',
          input as Record<string, unknown>,
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'payment_void',
      description: 'Void a payment. Requires reason.',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          id: idProp,
          reason: { type: 'string', description: 'Void reason' },
        },
        required: ['companyId', 'id', 'reason'],
      },
      handler: async (args) =>
        apiMutation(
          'payment.void',
          { id: getString(args, 'id'), reason: getString(args, 'reason') },
          getString(args, 'companyId')
        ),
    },
  ];
}
