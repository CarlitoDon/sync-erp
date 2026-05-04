/**
 * Expense Tools
 */
import type { ToolSpec } from '../types.js';
import { apiQuery, apiMutation } from '../client.js';
import { getString, companyIdProp, idProp } from './_helpers.js';

export function getExpenseTools(): ToolSpec[] {
  return [
    {
      name: 'expense_list',
      description: 'List all expenses for a company',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery('expense.list', {}, getString(args, 'companyId')),
    },
    {
      name: 'expense_get',
      description: 'Get expense details by ID',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiQuery('expense.byId', { id: getString(args, 'id') }, getString(args, 'companyId')),
    },
    {
      name: 'expense_create',
      description:
        'Create an expense. Input JSON: {partnerId, date, items: [{description, quantity, price, productId?}], taxRate?, reference?, dueDate?}',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: {
            type: 'string',
            description:
              'JSON: {partnerId, date, items: [{description, quantity, price}], taxRate?, reference?}',
          },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'expense.create',
          input as Record<string, unknown>,
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'expense_post',
      description: 'Post an expense to the ledger',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation('expense.post', { id: getString(args, 'id') }, getString(args, 'companyId')),
    },
  ];
}
