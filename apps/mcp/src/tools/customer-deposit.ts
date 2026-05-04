/**
 * Customer Deposit Tools (Cash Upfront Sales)
 */
import type { ToolSpec } from '../types.js';
import { apiQuery, apiMutation } from '../client.js';
import { getString, companyIdProp } from './_helpers.js';

export function getCustomerDepositTools(): ToolSpec[] {
  return [
    {
      name: 'customer_deposit_register',
      description:
        'Register a customer deposit for a SO. Input JSON: {orderId, amount, method, accountId, reference?, businessDate?}',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: {
            type: 'string',
            description: 'JSON: {orderId, amount, method, accountId, reference?, businessDate?}',
          },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'customerDeposit.registerDeposit',
          input as Record<string, unknown>,
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'customer_deposit_summary',
      description: 'Get deposit summary for a sales order',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          orderId: { type: 'string', description: 'SO UUID' },
        },
        required: ['companyId', 'orderId'],
      },
      handler: async (args) =>
        apiQuery(
          'customerDeposit.getDepositSummary',
          { orderId: getString(args, 'orderId') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'customer_deposit_info',
      description: 'Get deposit info for an invoice (for settlement)',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          invoiceId: { type: 'string', description: 'Invoice UUID' },
        },
        required: ['companyId', 'invoiceId'],
      },
      handler: async (args) =>
        apiQuery(
          'customerDeposit.getDepositInfo',
          { invoiceId: getString(args, 'invoiceId') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'customer_deposit_settle',
      description: 'Settle customer deposit against an invoice AR',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          invoiceId: { type: 'string', description: 'Invoice UUID' },
        },
        required: ['companyId', 'invoiceId'],
      },
      handler: async (args) =>
        apiMutation(
          'customerDeposit.settleDeposit',
          { invoiceId: getString(args, 'invoiceId') },
          getString(args, 'companyId')
        ),
    },
  ];
}
