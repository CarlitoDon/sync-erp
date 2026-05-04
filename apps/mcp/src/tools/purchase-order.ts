/**
 * Purchase Order Tools
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

export function getPurchaseOrderTools(): ToolSpec[] {
  return [
    {
      name: 'purchase_order_list',
      description: 'List all purchase orders for a company',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, status: statusFilterProp },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery(
          'purchaseOrder.list',
          buildInput([['status', getOptionalString(args, 'status')]]),
          getString(args, 'companyId')
        ),
    },
    {
      name: 'purchase_order_get',
      description: 'Get purchase order details by ID',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiQuery(
          'purchaseOrder.getById',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'purchase_order_create',
      description:
        'Create a purchase order. Requires partnerId and items [{productId, quantity, unitPrice}]',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          partnerId: { type: 'string', description: 'Supplier partner UUID' },
          items: {
            type: 'string',
            description: 'JSON array of items: [{productId, quantity, unitPrice}]',
          },
          reference: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['companyId', 'partnerId', 'items'],
      },
      handler: async (args) => {
        const companyId = getString(args, 'companyId');
        const partnerId = getString(args, 'partnerId');
        const items: unknown = JSON.parse(getString(args, 'items'));
        return apiMutation(
          'purchaseOrder.create',
          buildInput([
            ['partnerId', partnerId],
            ['items', items],
            ['reference', getOptionalString(args, 'reference')],
            ['notes', getOptionalString(args, 'notes')],
          ]),
          companyId
        );
      },
    },
    {
      name: 'purchase_order_confirm',
      description: 'Confirm a draft purchase order',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation(
          'purchaseOrder.confirm',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'purchase_order_cancel',
      description: 'Cancel a purchase order',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation(
          'purchaseOrder.cancel',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'purchase_order_close',
      description: 'Close PO (even if partially received). Requires reason.',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          id: idProp,
          reason: { type: 'string', description: 'Close reason' },
        },
        required: ['companyId', 'id', 'reason'],
      },
      handler: async (args) =>
        apiMutation(
          'purchaseOrder.close',
          { id: getString(args, 'id'), reason: getString(args, 'reason') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'purchase_order_received_quantities',
      description: 'Get received quantities for a purchase order',
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
          'purchaseOrder.getReceivedQuantities',
          { orderId: getString(args, 'orderId') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'purchase_order_return',
      description:
        'Process a purchase return. items: [{productId, quantity}]',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          orderId: { type: 'string', description: 'PO UUID' },
          items: {
            type: 'string',
            description: 'JSON array: [{productId, quantity}]',
          },
        },
        required: ['companyId', 'orderId', 'items'],
      },
      handler: async (args) => {
        const items: unknown = JSON.parse(getString(args, 'items'));
        return apiMutation(
          'purchaseOrder.returnToPo',
          { orderId: getString(args, 'orderId'), items },
          getString(args, 'companyId')
        );
      },
    },
  ];
}
