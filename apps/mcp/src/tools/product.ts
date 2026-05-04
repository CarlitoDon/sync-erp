/**
 * Product Tools
 */
import type { ToolSpec } from '../types.js';
import { apiQuery, apiMutation } from '../client.js';
import { getString, companyIdProp, idProp } from './_helpers.js';

export function getProductTools(): ToolSpec[] {
  return [
    {
      name: 'product_list',
      description: 'List all products for a company',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery('product.list', {}, getString(args, 'companyId')),
    },
    {
      name: 'product_get',
      description: 'Get product details by ID',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiQuery(
          'product.getById',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'product_create',
      description: 'Create a new product',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          name: { type: 'string', description: 'Product name' },
          sku: { type: 'string', description: 'Stock Keeping Unit' },
          price: { type: 'number', description: 'Selling price' },
          cost: { type: 'number', description: 'Cost price' },
          description: { type: 'string', description: 'Product description' },
          unit: { type: 'string', description: 'Unit of measure' },
        },
        required: ['companyId', 'name'],
      },
      handler: async (args) => {
        const companyId = getString(args, 'companyId');
        const { companyId: _, ...input } = args;
        return apiMutation('product.create', input, companyId);
      },
    },
    {
      name: 'product_update',
      description: 'Update an existing product',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          id: idProp,
          data: {
            type: 'object',
            description: 'Fields to update',
            properties: {},
          },
        },
        required: ['companyId', 'id', 'data'],
      },
      handler: async (args) => {
        const companyId = getString(args, 'companyId');
        const id = getString(args, 'id');
        const data = args.data as Record<string, unknown>;
        return apiMutation('product.update', { id, data }, companyId);
      },
    },
    {
      name: 'product_delete',
      description: 'Delete a product',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation(
          'product.delete',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
  ];
}
