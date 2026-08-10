import type { ToolSpec } from '../types.js';
import { apiQuery, apiMutation } from '../client.js';
import { getString, companyIdProp, idProp } from './_helpers.js';

function withoutCompanyId(input: Record<string, unknown>) {
  const scopedInput = { ...input };
  delete scopedInput.companyId;
  return scopedInput;
}

export function getRentalBundleTools(): ToolSpec[] {
  return [
    {
      name: 'rental_bundle_list',
      description: 'List rental bundles/packages for a company',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery(
          'rentalBundle.list',
          {},
          getString(args, 'companyId'),
          true
        ),
    },
    {
      name: 'rental_bundle_get',
      description: 'Get rental bundle details by ID',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiQuery('rentalBundle.getById', { id: getString(args, 'id') }, getString(args, 'companyId')),
    },
    {
      name: 'rental_bundle_create',
      description: 'Create a rental bundle. Input JSON: {name, dailyRate, components?}',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: { type: 'string', description: 'JSON of bundle fields' },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const cid = getString(args, 'companyId');
        const parsed: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'rentalBundle.create',
          withoutCompanyId(parsed as Record<string, unknown>),
          cid
        );
      },
    },
    {
      name: 'rental_bundle_update',
      description: 'Update a rental bundle. Input JSON: {id, name?, dailyRate?}',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: { type: 'string', description: 'JSON fields to update' },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'rentalBundle.update',
          withoutCompanyId(input as Record<string, unknown>),
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'rental_bundle_availability',
      description: 'Check component availability for a bundle',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          bundleId: { type: 'string', description: 'Bundle UUID' },
          orderQuantity: { type: 'number', default: 1 },
        },
        required: ['companyId', 'bundleId'],
      },
      handler: async (args) => {
        const qty = typeof args.orderQuantity === 'number' ? args.orderQuantity : 1;
        return apiQuery('rentalBundle.getComponentAvailability', { bundleId: getString(args, 'bundleId'), orderQuantity: qty }, getString(args, 'companyId'));
      },
    },
  ];
}
