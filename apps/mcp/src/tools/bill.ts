/**
 * Bill Tools (Accounts Payable)
 */
import type { ToolSpec } from '../types.js';
import { apiQuery, apiMutation } from '../client.js';
import {
  getString,
  getOptionalString,
  getOptionalNumber,
  getOptionalBoolean,
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
      name: 'bill_installment_list',
      description: 'List installment schedule lines for a bill',
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
          'bill.installments.list',
          { billId: getString(args, 'billId') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'bill_installment_create_schedule',
      description:
        'Create a non-journal installment schedule for a bill. Pass input JSON {billId, installments:[{dueDate, amount, notes?}], replaceExisting?}.',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: {
            type: 'string',
            description: 'JSON schedule payload',
          },
          billId: { type: 'string', description: 'Bill UUID' },
          installments: {
            type: 'string',
            description:
              'JSON array of installment lines when input is not provided',
          },
          replaceExisting: {
            type: 'boolean',
            description: 'Replace existing unpaid schedule lines',
          },
        },
        required: ['companyId'],
      },
      handler: async (args) => {
        const rawInput = getOptionalString(args, 'input');
        const parsedInput = rawInput
          ? (JSON.parse(rawInput) as Record<string, unknown>)
          : undefined;
        const rawInstallments = getOptionalString(args, 'installments');
        const installments = rawInstallments
          ? (JSON.parse(rawInstallments) as unknown)
          : undefined;

        return apiMutation(
          'bill.installments.createSchedule',
          parsedInput ??
            buildInput([
              ['billId', getOptionalString(args, 'billId')],
              ['installments', installments],
              [
                'replaceExisting',
                getOptionalBoolean(args, 'replaceExisting'),
              ],
            ]),
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'bill_installment_mark_paid',
      description:
        'Mark an installment as paid by linking it to an existing payment. Does not create payment or journal.',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          installmentId: {
            type: 'string',
            description: 'Bill installment UUID',
          },
          paymentId: { type: 'string', description: 'Existing payment UUID' },
          paidAt: {
            type: 'string',
            description: 'Optional paid date as ISO date/datetime',
          },
        },
        required: ['companyId', 'installmentId', 'paymentId'],
      },
      handler: async (args) =>
        apiMutation(
          'bill.installments.markPaid',
          buildInput([
            ['installmentId', getString(args, 'installmentId')],
            ['paymentId', getString(args, 'paymentId')],
            ['paidAt', getOptionalString(args, 'paidAt')],
          ]),
          getString(args, 'companyId')
        ),
    },
    {
      name: 'bill_installment_cancel',
      description: 'Cancel an unpaid bill installment schedule line',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          installmentId: {
            type: 'string',
            description: 'Bill installment UUID',
          },
          notes: { type: 'string', description: 'Cancellation notes' },
        },
        required: ['companyId', 'installmentId'],
      },
      handler: async (args) =>
        apiMutation(
          'bill.installments.cancel',
          buildInput([
            ['installmentId', getString(args, 'installmentId')],
            ['notes', getOptionalString(args, 'notes')],
          ]),
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
          reference: {
            type: 'string',
            description:
              'Vendor bill reference, mapped to supplierInvoiceNumber',
          },
          supplierInvoiceNumber: {
            type: 'string',
            description: 'Vendor invoice/reference number',
          },
          dueDate: {
            type: 'string',
            description: 'Bill due date as ISO date or datetime',
          },
          businessDate: {
            type: 'string',
            description: 'Bill date as ISO date or datetime',
          },
          fulfillmentId: {
            type: 'string',
            description: 'Optional GRN/receipt UUID to bill',
          },
        },
        required: ['companyId', 'orderId'],
      },
      handler: async (args) =>
        apiMutation(
          'bill.createFromPO',
          buildInput([
            ['orderId', getString(args, 'orderId')],
            [
              'supplierInvoiceNumber',
              getOptionalString(args, 'supplierInvoiceNumber') ??
                getOptionalString(args, 'reference'),
            ],
            ['dueDate', getOptionalString(args, 'dueDate')],
            ['businessDate', getOptionalString(args, 'businessDate')],
            ['fulfillmentId', getOptionalString(args, 'fulfillmentId')],
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
        properties: {
          companyId: companyIdProp,
          id: idProp,
          businessDate: {
            type: 'string',
            description: 'Posting date as ISO date or datetime',
          },
        },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation(
          'bill.post',
          buildInput([
            ['id', getString(args, 'id')],
            ['businessDate', getOptionalString(args, 'businessDate')],
          ]),
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
