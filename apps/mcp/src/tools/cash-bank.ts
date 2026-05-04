import type { ToolSpec } from '../types.js';
import { apiQuery, apiMutation } from '../client.js';
import { getString, getOptionalString, companyIdProp, idProp, buildInput } from './_helpers.js';

export function getCashBankTools(): ToolSpec[] {
  return [
    {
      name: 'cash_bank_account_list',
      description: 'List all bank accounts',
      inputSchema: { type: 'object', properties: { companyId: companyIdProp }, required: ['companyId'] },
      handler: async (args) => apiQuery('cashBank.listAccounts', {}, getString(args, 'companyId')),
    },
    {
      name: 'cash_bank_account_get',
      description: 'Get bank account by ID',
      inputSchema: { type: 'object', properties: { companyId: companyIdProp, id: idProp }, required: ['companyId', 'id'] },
      handler: async (args) => apiQuery('cashBank.getAccount', { id: getString(args, 'id') }, getString(args, 'companyId')),
    },
    {
      name: 'cash_bank_account_create',
      description: 'Create bank account. Input JSON: {name, accountNumber, bankName, type, accountId?}',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, input: { type: 'string', description: 'JSON fields' } },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation('cashBank.createAccount', input as Record<string, unknown>, getString(args, 'companyId'));
      },
    },
    {
      name: 'cash_bank_account_update',
      description: 'Update bank account. Input JSON: {id, ...fields}',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, input: { type: 'string', description: 'JSON: {id, ...fields}' } },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation('cashBank.updateAccount', input as Record<string, unknown>, getString(args, 'companyId'));
      },
    },
    {
      name: 'cash_bank_transaction_list',
      description: 'List cash/bank transactions',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          bankAccountId: { type: 'string' },
          status: { type: 'string', enum: ['DRAFT', 'POSTED', 'VOIDED'] },
        },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery('cashBank.listTransactions', buildInput([
          ['bankAccountId', getOptionalString(args, 'bankAccountId')],
          ['status', getOptionalString(args, 'status')],
        ]), getString(args, 'companyId')),
    },
    {
      name: 'cash_bank_transaction_get',
      description: 'Get transaction details',
      inputSchema: { type: 'object', properties: { companyId: companyIdProp, id: idProp }, required: ['companyId', 'id'] },
      handler: async (args) => apiQuery('cashBank.getTransaction', { id: getString(args, 'id') }, getString(args, 'companyId')),
    },
    {
      name: 'cash_bank_transaction_create',
      description: 'Create cash/bank transaction. Input JSON: {type, bankAccountId, amount, date, ...}',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, input: { type: 'string', description: 'JSON fields' } },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation('cashBank.createTransaction', input as Record<string, unknown>, getString(args, 'companyId'));
      },
    },
    {
      name: 'cash_bank_transaction_post',
      description: 'Post a draft transaction',
      inputSchema: { type: 'object', properties: { companyId: companyIdProp, id: idProp }, required: ['companyId', 'id'] },
      handler: async (args) => apiMutation('cashBank.postTransaction', { id: getString(args, 'id') }, getString(args, 'companyId')),
    },
    {
      name: 'cash_bank_transaction_void',
      description: 'Void a posted transaction. Requires reason.',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp, reason: { type: 'string' } },
        required: ['companyId', 'id', 'reason'],
      },
      handler: async (args) =>
        apiMutation('cashBank.voidTransaction', { id: getString(args, 'id'), reason: getString(args, 'reason') }, getString(args, 'companyId')),
    },
  ];
}
