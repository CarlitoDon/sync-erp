/**
 * Invoice Tools (Accounts Receivable)
 */
import type { ToolSpec } from '../types.js';
import { apiQuery, apiMutation } from '../client.js';
import {
  getString,
  getOptionalString,
  companyIdProp,
  idProp,
  statusFilterProp,
  buildInput,
} from './_helpers.js';

export function getInvoiceTools(): ToolSpec[] {
  return [
    {
      name: 'invoice_list',
      description: 'List all invoices (AR) for a company',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, status: statusFilterProp },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery(
          'invoice.list',
          buildInput([['status', getOptionalString(args, 'status')]]),
          getString(args, 'companyId')
        ),
    },
    {
      name: 'invoice_get',
      description: 'Get invoice details by ID',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiQuery(
          'invoice.getById',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'invoice_create_from_so',
      description: 'Create an invoice from a sales order',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          orderId: { type: 'string', description: 'Sales order UUID' },
          reference: { type: 'string' },
        },
        required: ['companyId', 'orderId'],
      },
      handler: async (args) =>
        apiMutation(
          'invoice.createFromSO',
          buildInput([
            ['orderId', getString(args, 'orderId')],
            ['reference', getOptionalString(args, 'reference')],
          ]),
          getString(args, 'companyId')
        ),
    },
    {
      name: 'invoice_post',
      description: 'Post an invoice to the ledger',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation(
          'invoice.post',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'invoice_void',
      description: 'Void an invoice. Requires reason.',
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
          'invoice.void',
          { id: getString(args, 'id'), reason: getString(args, 'reason') },
          getString(args, 'companyId')
        ),
    },
  ];
}
