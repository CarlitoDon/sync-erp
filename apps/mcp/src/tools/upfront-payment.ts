/**
 * Upfront Payment Tools (Procurement Down Payments)
 */
import type { ToolSpec } from '../types.js';
import { apiQuery, apiMutation } from '../client.js';
import { getString, companyIdProp } from './_helpers.js';

export function getUpfrontPaymentTools(): ToolSpec[] {
  return [
    {
      name: 'upfront_payment_register',
      description:
        'Register an upfront payment for a PO. Input JSON: {orderId, amount, method, accountId, reference?, businessDate?}',
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
          'upfrontPayment.registerPayment',
          input as Record<string, unknown>,
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'upfront_payment_summary',
      description: 'Get payment summary for a purchase order',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          orderId: { type: 'string', description: 'PO UUID' },
        },
        required: ['companyId', 'orderId'],
      },
      handler: async (args) =>
        apiQuery(
          'upfrontPayment.getPaymentSummary',
          { orderId: getString(args, 'orderId') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'upfront_payment_prepaid_info',
      description: 'Get prepaid info for a bill (for settlement)',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          billId: { type: 'string', description: 'Bill UUID' },
        },
        required: ['companyId', 'billId'],
      },
      handler: async (args) =>
        apiQuery(
          'upfrontPayment.getPrepaidInfo',
          { billId: getString(args, 'billId') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'upfront_payment_settle',
      description: 'Settle prepaid against a bill AP',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          billId: { type: 'string', description: 'Bill UUID' },
        },
        required: ['companyId', 'billId'],
      },
      handler: async (args) =>
        apiMutation(
          'upfrontPayment.settlePrepaid',
          { billId: getString(args, 'billId') },
          getString(args, 'companyId')
        ),
    },
  ];
}
