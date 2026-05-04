/**
 * Sales Order Tools
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

export function getSalesOrderTools(): ToolSpec[] {
  return [
    {
      name: 'sales_order_list',
      description: 'List all sales orders for a company',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          status: statusFilterProp,
        },
        required: ['companyId'],
      },
      handler: async (args) => {
        const status = getOptionalString(args, 'status');
        return apiQuery(
          'salesOrder.list',
          buildInput([['status', status]]),
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'sales_order_get',
      description: 'Get sales order details by ID',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiQuery(
          'salesOrder.getById',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'sales_order_create',
      description:
        'Create a new sales order. Requires partnerId and items array [{productId, quantity, price}]',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          partnerId: { type: 'string', description: 'Customer partner UUID' },
          items: {
            type: 'string',
            description:
              'JSON array of items: [{productId, quantity, price}]',
          },
          reference: { type: 'string', description: 'External reference' },
          notes: { type: 'string', description: 'Order notes' },
        },
        required: ['companyId', 'partnerId', 'items'],
      },
      handler: async (args) => {
        const companyId = getString(args, 'companyId');
        const partnerId = getString(args, 'partnerId');
        const itemsRaw = getString(args, 'items');
        const parsedItems = JSON.parse(itemsRaw) as Array<
          Record<string, unknown>
        >;
        const items = parsedItems.map((item) => ({
          ...item,
          price:
            item.price ??
            item.unitPrice,
        }));
        const input = buildInput([
          ['type', 'SALES'],
          ['partnerId', partnerId],
          ['items', items],
          ['reference', getOptionalString(args, 'reference')],
          ['notes', getOptionalString(args, 'notes')],
        ]);
        return apiMutation('salesOrder.create', input, companyId);
      },
    },
    {
      name: 'sales_order_confirm',
      description: 'Confirm a draft sales order',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation(
          'salesOrder.confirm',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'sales_order_ship',
      description: 'Ship/deliver a confirmed sales order',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          id: idProp,
          reference: { type: 'string', description: 'Shipping reference' },
        },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation(
          'salesOrder.ship',
          buildInput([
            ['id', getString(args, 'id')],
            ['reference', getOptionalString(args, 'reference')],
          ]),
          getString(args, 'companyId')
        ),
    },
    {
      name: 'sales_order_cancel',
      description: 'Cancel a sales order',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation(
          'salesOrder.cancel',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'sales_order_close',
      description: 'Close a sales order (even if partially shipped). Requires reason.',
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
          'salesOrder.close',
          { id: getString(args, 'id'), reason: getString(args, 'reason') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'sales_order_shipped_quantities',
      description: 'Get shipped quantities for a sales order',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          orderId: { type: 'string', description: 'Sales order UUID' },
        },
        required: ['companyId', 'orderId'],
      },
      handler: async (args) =>
        apiQuery(
          'salesOrder.getShippedQuantities',
          { orderId: getString(args, 'orderId') },
          getString(args, 'companyId')
        ),
    },
  ];
}
