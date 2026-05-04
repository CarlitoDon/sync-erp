/**
 * Finance & Accounting Tools
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

export function getFinanceTools(): ToolSpec[] {
  return [
    // Accounts
    {
      name: 'finance_accounts_list',
      description: 'List all chart of accounts',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery('finance.listAccounts', {}, getString(args, 'companyId')),
    },
    {
      name: 'finance_account_create',
      description: 'Create a new account. Pass input as JSON: {code, name, type, parentId?}',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: { type: 'string', description: 'JSON: {code, name, type, parentId?}' },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'finance.createAccount',
          input as Record<string, unknown>,
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'finance_accounts_seed',
      description: 'Seed the default chart of accounts for a company',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiMutation('finance.seedAccounts', {}, getString(args, 'companyId')),
    },
    // Journals
    {
      name: 'finance_journals_list',
      description: 'List journal entries, optionally filtered by date range',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          startDate: { type: 'string', description: 'ISO date string' },
          endDate: { type: 'string', description: 'ISO date string' },
        },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery(
          'finance.listJournals',
          buildInput([
            ['startDate', getOptionalString(args, 'startDate')],
            ['endDate', getOptionalString(args, 'endDate')],
          ]),
          getString(args, 'companyId')
        ),
    },
    {
      name: 'finance_journal_get',
      description: 'Get journal entry details by ID',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiQuery(
          'finance.getJournalById',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'finance_journal_create',
      description: 'Create a manual journal entry. Input JSON: {date, memo, lines: [{accountId, debit, credit}]}',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: {
            type: 'string',
            description: 'JSON: {date, memo, lines: [{accountId, debit, credit}]}',
          },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'finance.createJournal',
          input as Record<string, unknown>,
          getString(args, 'companyId')
        );
      },
    },
    // Reports
    {
      name: 'finance_trial_balance',
      description: 'Get trial balance report',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          date: { type: 'string', description: 'As-of date (ISO string)' },
        },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery(
          'finance.getTrialBalance',
          buildInput([['date', getOptionalString(args, 'date')]]),
          getString(args, 'companyId')
        ),
    },
    {
      name: 'finance_general_ledger',
      description: 'Get general ledger report for a specific account',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          accountId: { type: 'string', description: 'Account UUID' },
          startDate: { type: 'string', description: 'ISO date' },
          endDate: { type: 'string', description: 'ISO date' },
        },
        required: ['companyId', 'accountId'],
      },
      handler: async (args) =>
        apiQuery(
          'finance.getGeneralLedger',
          buildInput([
            ['accountId', getString(args, 'accountId')],
            ['startDate', getOptionalString(args, 'startDate')],
            ['endDate', getOptionalString(args, 'endDate')],
          ]),
          getString(args, 'companyId')
        ),
    },
    {
      name: 'finance_income_statement',
      description: 'Get income statement (P&L) report',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          startDate: { type: 'string', description: 'ISO date' },
          endDate: { type: 'string', description: 'ISO date' },
        },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery(
          'finance.getIncomeStatement',
          buildInput([
            ['startDate', getOptionalString(args, 'startDate')],
            ['endDate', getOptionalString(args, 'endDate')],
          ]),
          getString(args, 'companyId')
        ),
    },
  ];
}
