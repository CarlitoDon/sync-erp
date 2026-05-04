/**
 * Bill Tools (Accounts Payable)
 */
import type { ToolSpec } from '../types.js';
import { apiQuery, apiMutation } from '../client.js';
import {
  getString,
  getOptionalString,
  getOptionalNumber,
  companyIdProp,
  idProp,
  statusFilterProp,
  buildInput,
} from './_helpers.js';

export function getBillTools(): ToolSpec[] {
  return [
    {
      name: 'bill_list',
      description: 'List all bills (AP) for a company',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, status: statusFilterProp },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery(
          'bill.list',
          buildInput([['status', getOptionalString(args, 'status')]]),
          getString(args, 'companyId')
        ),
    },
    {
      name: 'bill_get',
      description: 'Get bill details by ID',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiQuery(
          'bill.getById',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'bill_create_from_po',
      description: 'Create a bill from a purchase order',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          orderId: { type: 'string', description: 'Purchase order UUID' },
          reference: { type: 'string', description: 'Vendor bill reference' },
        },
        required: ['companyId', 'orderId'],
      },
      handler: async (args) =>
        apiMutation(
          'bill.createFromPO',
          buildInput([
            ['orderId', getString(args, 'orderId')],
            ['reference', getOptionalString(args, 'reference')],
          ]),
          getString(args, 'companyId')
        ),
    },
    {
      name: 'bill_create_dp',
      description: 'Create a down payment bill for a PO with DP requirement',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          orderId: { type: 'string', description: 'PO UUID' },
          amount: { type: 'number', description: 'Custom DP amount (optional)' },
        },
        required: ['companyId', 'orderId'],
      },
      handler: async (args) =>
        apiMutation(
          'bill.createDpBill',
          buildInput([
            ['orderId', getString(args, 'orderId')],
            ['amount', getOptionalNumber(args, 'amount')],
          ]),
          getString(args, 'companyId')
        ),
    },
    {
      name: 'bill_post',
      description: 'Post a bill to the ledger',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation(
          'bill.post',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'bill_void',
      description: 'Void a bill. Requires reason.',
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
          'bill.void',
          { id: getString(args, 'id'), reason: getString(args, 'reason') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'bill_delete',
      description: 'Delete a DRAFT bill',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation(
          'bill.delete',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
  ];
}
