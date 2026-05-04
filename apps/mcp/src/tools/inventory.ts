/**
 * Inventory Tools
 */
import type { ToolSpec } from '../types.js';
import { apiQuery, apiMutation } from '../client.js';
import {
  getString,
  getOptionalString,
  getOptionalNumber,
  companyIdProp,
  idProp,
  buildInput,
} from './_helpers.js';

export function getInventoryTools(): ToolSpec[] {
  return [
    {
      name: 'inventory_movements',
      description: 'List inventory movements, optionally filtered by product',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          productId: { type: 'string', description: 'Filter by product UUID' },
        },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery(
          'inventory.getMovements',
          buildInput([['productId', getOptionalString(args, 'productId')]]),
          getString(args, 'companyId')
        ),
    },
    {
      name: 'inventory_stock_levels',
      description: 'Get current stock levels for all products',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery('inventory.getStockLevels', {}, getString(args, 'companyId')),
    },
    // GRN
    {
      name: 'inventory_grn_list',
      description: 'List all Goods Receipt Notes',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery('inventory.listGRN', {}, getString(args, 'companyId')),
    },
    {
      name: 'inventory_grn_get',
      description: 'Get GRN details by ID',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiQuery(
          'inventory.getGRN',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'inventory_grn_create',
      description:
        'Create a GRN. Pass input as JSON: {orderId, items: [{productId, quantity}]}',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: { type: 'string', description: 'JSON: {orderId, items: [{productId, quantity}]}' },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const parsedInput = JSON.parse(getString(args, 'input')) as Record<
          string,
          unknown
        >;
        const input = {
          ...parsedInput,
          purchaseOrderId:
            parsedInput.purchaseOrderId ?? parsedInput.orderId,
        };
        return apiMutation(
          'inventory.createGRN',
          input,
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'inventory_grn_post',
      description: 'Post a GRN (process stock in)',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation(
          'inventory.postGRN',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'inventory_grn_void',
      description: 'Void a posted GRN. Requires reason.',
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
          'inventory.voidGRN',
          { id: getString(args, 'id'), reason: getString(args, 'reason') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'inventory_grn_delete',
      description: 'Delete a draft GRN',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation(
          'inventory.deleteGRN',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    // Shipments
    {
      name: 'inventory_shipment_list',
      description: 'List all shipments',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery('inventory.listShipments', {}, getString(args, 'companyId')),
    },
    {
      name: 'inventory_shipment_get',
      description: 'Get shipment details by ID',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiQuery(
          'inventory.getShipment',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'inventory_shipment_create',
      description:
        'Create a shipment. Pass input as JSON: {orderId, items: [{productId, quantity}]}',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: { type: 'string', description: 'JSON: {orderId, items: [{productId, quantity}]}' },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const parsedInput = JSON.parse(getString(args, 'input')) as Record<
          string,
          unknown
        >;
        const input = {
          ...parsedInput,
          salesOrderId: parsedInput.salesOrderId ?? parsedInput.orderId,
        };
        return apiMutation(
          'inventory.createShipment',
          input,
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'inventory_shipment_post',
      description: 'Post a shipment (process stock out)',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation(
          'inventory.postShipment',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'inventory_shipment_void',
      description: 'Void a posted shipment. Requires reason.',
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
          'inventory.voidShipment',
          { id: getString(args, 'id'), reason: getString(args, 'reason') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'inventory_shipment_delete',
      description: 'Delete a draft shipment',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation(
          'inventory.deleteShipment',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    // Stock Adjustment
    {
      name: 'inventory_adjust_stock',
      description: 'Manual stock adjustment (correction)',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          productId: { type: 'string', description: 'Product UUID' },
          quantity: { type: 'number', description: 'Adjustment quantity (+/-)' },
          costPerUnit: { type: 'number', description: 'Cost per unit' },
          reference: { type: 'string', description: 'Reference note' },
        },
        required: ['companyId', 'productId', 'quantity'],
      },
      handler: async (args) =>
        apiMutation(
          'inventory.adjustStock',
          buildInput([
            ['productId', getString(args, 'productId')],
            ['quantity', args.quantity],
            ['costPerUnit', getOptionalNumber(args, 'costPerUnit')],
            ['reference', getOptionalString(args, 'reference')],
          ]),
          getString(args, 'companyId')
        ),
    },
  ];
}
