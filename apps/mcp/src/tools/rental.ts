/**
 * Rental Tools (Items, Orders, Availability, Returns, Policy)
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

export function getRentalTools(): ToolSpec[] {
  return [
    // ── Items ────────────────────────────────────────
    {
      name: 'rental_item_list',
      description: 'List rental items for a company',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          category: { type: 'string', description: 'Filter by category' },
        },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery(
          'rental.items.list',
          buildInput([['category', getOptionalString(args, 'category')]]),
          getString(args, 'companyId')
        ),
    },
    {
      name: 'rental_item_create',
      description:
        'Create a rental item. Input JSON: {name, category?, dailyRate, weeklyRate?, monthlyRate?, productId?}',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: { type: 'string', description: 'JSON of rental item fields' },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'rental.items.create',
          input as Record<string, unknown>,
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'rental_item_convert_stock',
      description: 'Convert stock items into rentable units',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          rentalItemId: { type: 'string', description: 'Rental item UUID' },
          quantity: { type: 'number', description: 'Number of units to create' },
        },
        required: ['companyId', 'rentalItemId', 'quantity'],
      },
      handler: async (args) =>
        apiMutation(
          'rental.items.convertStock',
          {
            rentalItemId: getString(args, 'rentalItemId'),
            quantity: args.quantity,
          },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'rental_unit_update_status',
      description: 'Update rental unit status (AVAILABLE, MAINTENANCE, RETIRED)',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          unitId: { type: 'string', description: 'Unit UUID' },
          status: {
            type: 'string',
            enum: ['AVAILABLE', 'MAINTENANCE', 'RETIRED'],
          },
          reason: { type: 'string', description: 'Status change reason' },
        },
        required: ['companyId', 'unitId', 'status'],
      },
      handler: async (args) =>
        apiMutation(
          'rental.items.updateUnitStatus',
          buildInput([
            ['unitId', getString(args, 'unitId')],
            ['status', getString(args, 'status')],
            ['reason', getOptionalString(args, 'reason')],
          ]),
          getString(args, 'companyId')
        ),
    },

    // ── Orders ────────────────────────────────────────
    {
      name: 'rental_order_list',
      description: 'List rental orders for a company',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          status: {
            type: 'string',
            enum: ['DRAFT', 'PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
          },
          partnerId: { type: 'string', description: 'Filter by partner' },
        },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery(
          'rental.orders.list',
          buildInput([
            ['status', getOptionalString(args, 'status')],
            ['partnerId', getOptionalString(args, 'partnerId')],
          ]),
          getString(args, 'companyId')
        ),
    },
    {
      name: 'rental_order_get',
      description: 'Get rental order details by ID',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiQuery(
          'rental.orders.getById',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'rental_order_create',
      description:
        'Create a rental order. Input JSON: {partnerId, startDate, endDate, items: [{rentalItemId, quantity}], notes?}',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: { type: 'string', description: 'JSON of rental order fields' },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'rental.orders.create',
          input as Record<string, unknown>,
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'rental_order_confirm',
      description: 'Confirm a rental order. Input JSON: {orderId, unitAssignments?: [{lineId, unitId}]}',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: { type: 'string', description: 'JSON: {orderId, unitAssignments?}' },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'rental.orders.confirm',
          input as Record<string, unknown>,
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'rental_order_manual_confirm',
      description: 'Manually confirm a rental order with override options',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: { type: 'string', description: 'JSON: manual confirm input' },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'rental.orders.manualConfirm',
          input as Record<string, unknown>,
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'rental_order_release',
      description: 'Release items for a confirmed rental order',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: { type: 'string', description: 'JSON: {orderId}' },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'rental.orders.release',
          input as Record<string, unknown>,
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'rental_order_cancel',
      description: 'Cancel a rental order. Requires reason.',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          orderId: { type: 'string', description: 'Order UUID' },
          reason: { type: 'string', description: 'Cancellation reason' },
        },
        required: ['companyId', 'orderId', 'reason'],
      },
      handler: async (args) =>
        apiMutation(
          'rental.orders.cancel',
          { orderId: getString(args, 'orderId'), reason: getString(args, 'reason') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'rental_order_extend',
      description: 'Extend a rental order. Input JSON: {orderId, newEndDate, reason?}',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: { type: 'string', description: 'JSON: {orderId, newEndDate, reason?}' },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'rental.orders.extend',
          input as Record<string, unknown>,
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'rental_order_verify_payment',
      description: 'Verify payment for a rental order (confirm/reject)',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          orderId: { type: 'string', description: 'Order UUID' },
          action: { type: 'string', enum: ['confirm', 'reject'] },
          paymentReference: { type: 'string' },
          failReason: { type: 'string' },
        },
        required: ['companyId', 'orderId', 'action'],
      },
      handler: async (args) =>
        apiMutation(
          'rental.orders.verifyPayment',
          buildInput([
            ['orderId', getString(args, 'orderId')],
            ['action', getString(args, 'action')],
            ['paymentReference', getOptionalString(args, 'paymentReference')],
            ['failReason', getOptionalString(args, 'failReason')],
          ]),
          getString(args, 'companyId')
        ),
    },

    // ── Availability ────────────────────────────────────────
    {
      name: 'rental_availability_check',
      description: 'Check rental item availability for a date range',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          startDate: { type: 'string', description: 'ISO date' },
          endDate: { type: 'string', description: 'ISO date' },
          itemId: { type: 'string', description: 'Optional: filter by item UUID' },
        },
        required: ['companyId', 'startDate', 'endDate'],
      },
      handler: async (args) =>
        apiQuery(
          'rental.availability.check',
          buildInput([
            ['startDate', getString(args, 'startDate')],
            ['endDate', getString(args, 'endDate')],
            ['itemId', getOptionalString(args, 'itemId')],
          ]),
          getString(args, 'companyId')
        ),
    },
    {
      name: 'rental_units_by_item',
      description: 'Get units for a rental item, optionally filtered by status',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          itemId: { type: 'string', description: 'Rental item UUID' },
          status: { type: 'string', description: 'Filter by unit status' },
        },
        required: ['companyId', 'itemId'],
      },
      handler: async (args) =>
        apiQuery(
          'rental.availability.getUnitsByItem',
          buildInput([
            ['itemId', getString(args, 'itemId')],
            ['status', getOptionalString(args, 'status')],
          ]),
          getString(args, 'companyId')
        ),
    },
    {
      name: 'rental_timeline',
      description: 'Get scheduler timeline data for rental visualization',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          startDate: { type: 'string', description: 'ISO date' },
          endDate: { type: 'string', description: 'ISO date' },
        },
        required: ['companyId', 'startDate', 'endDate'],
      },
      handler: async (args) =>
        apiQuery(
          'rental.availability.timeline',
          {
            startDate: getString(args, 'startDate'),
            endDate: getString(args, 'endDate'),
          },
          getString(args, 'companyId')
        ),
    },

    // ── Returns ────────────────────────────────────────
    {
      name: 'rental_return_process',
      description: 'Process a rental return. Input JSON: {orderId, items: [{lineId, returnedQuantity, condition?, damageNotes?}]}',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: { type: 'string', description: 'JSON of return processing input' },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'rental.returns.process',
          input as Record<string, unknown>,
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'rental_return_finalize',
      description: 'Finalize a rental return',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          returnId: { type: 'string', description: 'Return UUID' },
        },
        required: ['companyId', 'returnId'],
      },
      handler: async (args) =>
        apiMutation(
          'rental.returns.finalize',
          { returnId: getString(args, 'returnId') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'rental_return_create_invoice',
      description: 'Create an invoice from a rental return',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          returnId: { type: 'string', description: 'Return UUID' },
        },
        required: ['companyId', 'returnId'],
      },
      handler: async (args) =>
        apiMutation(
          'rental.returns.createInvoice',
          { returnId: getString(args, 'returnId') },
          getString(args, 'companyId')
        ),
    },

    // ── Policy ────────────────────────────────────────
    {
      name: 'rental_policy_get',
      description: 'Get current rental policy for a company',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery('rental.policy.getCurrent', {}, getString(args, 'companyId')),
    },
    {
      name: 'rental_policy_update',
      description: 'Update rental policy. Input JSON: {lateFeeRate?, damageFeeRate?, ...}',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: { type: 'string', description: 'JSON of policy fields to update' },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'rental.policy.update',
          input as Record<string, unknown>,
          getString(args, 'companyId')
        );
      },
    },
  ];
}
