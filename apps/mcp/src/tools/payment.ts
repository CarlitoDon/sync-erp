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
<<<<<<< HEAD
        'Create a payment. Pass input as JSON string with fields: invoiceId/billId, amount, method, accountId/bankAccountId, paymentMethodId/paymentMethodCode, reference, businessDate',
=======
        'Create a payment. Pass input as JSON string with fields: invoiceId/billId, amount, method, accountId, reference, businessDate',
>>>>>>> origin/dev
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: {
            type: 'string',
            description:
<<<<<<< HEAD
              'JSON object: {invoiceId?, billId?, amount, method, accountId?, bankAccountId?, paymentMethodId?, paymentMethodCode?, reference?, businessDate?}',
=======
              'JSON object: {invoiceId?, billId?, amount, method, accountId, reference?, businessDate?}',
>>>>>>> origin/dev
          },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
<<<<<<< HEAD
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
          throw new Error('payment_create input must be a JSON object');
        }
        const normalized: Record<string, unknown> = {
          ...(input as Record<string, unknown>),
        };
        if (!normalized.invoiceId && normalized.billId) {
          normalized.invoiceId = normalized.billId;
        }
        if (!normalized.bankAccountId && normalized.accountId) {
          normalized.bankAccountId = normalized.accountId;
        }
        delete normalized.billId;
        delete normalized.accountId;
        return apiMutation(
          'payment.create',
          normalized,
=======
        return apiMutation(
          'payment.create',
          input as Record<string, unknown>,
>>>>>>> origin/dev
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
