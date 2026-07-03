/**
 * Rental Tools (Items, Orders, Availability, Returns, Policy)
 */
import type { ToolSpec } from '../types.js';
import { apiQuery, apiMutation } from '../client.js';
import {
  getString,
  getOptionalString,
<<<<<<< HEAD
  getOptionalNumber,
  getOptionalBoolean,
=======
>>>>>>> origin/dev
  companyIdProp,
  idProp,
  buildInput,
} from './_helpers.js';

<<<<<<< HEAD
function toRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const record = toRecord(item);
      return record ? [record] : [];
    });
  }

  const record = toRecord(value);
  const items = record?.items ?? record?.data;
  return Array.isArray(items)
    ? items.flatMap((item) => {
        const itemRecord = toRecord(item);
        return itemRecord ? [itemRecord] : [];
      })
    : [];
}

function getRecordString(
  record: Record<string, unknown>,
  key: string
): string | undefined {
  const value = record[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

function invoiceRefFromNotes(notes: unknown): string | undefined {
  if (typeof notes !== 'string') return undefined;
  return notes.match(/invoice_ref=([A-Za-z0-9._/-]+)/)?.[1];
}

function compactRentalOrderList(
  rawJson: string,
  notesContains?: string,
  rentalPaymentStatus?: string
): string {
  const parsed: unknown = JSON.parse(rawJson);
  const root = toRecord(parsed);
  const filter = notesContains?.toLowerCase();
  const paymentFilter = rentalPaymentStatus?.toUpperCase();
  const items = toRecordArray(parsed)
    .filter((order) => {
      const notesMatch = filter
        ? getRecordString(order, 'notes')?.toLowerCase().includes(filter)
        : true;
      const paymentMatch = paymentFilter
        ? getRecordString(order, 'rentalPaymentStatus') === paymentFilter
        : true;
      return notesMatch && paymentMatch;
    })
    .map((order) => {
      const partner = toRecord(order.partner);
      return {
        id: getRecordString(order, 'id'),
        orderNumber: getRecordString(order, 'orderNumber'),
        status: getRecordString(order, 'status'),
        rentalPaymentStatus: getRecordString(order, 'rentalPaymentStatus'),
        totalAmount: getRecordString(order, 'totalAmount'),
        subtotal: getRecordString(order, 'subtotal'),
        deliveryFee: getRecordString(order, 'deliveryFee'),
        rentalStartDate: getRecordString(order, 'rentalStartDate'),
        rentalEndDate: getRecordString(order, 'rentalEndDate'),
        partnerName: partner ? getRecordString(partner, 'name') : undefined,
        invoiceRef: invoiceRefFromNotes(order.notes),
      };
    });

  const statusCounts = items.reduce<Record<string, number>>((acc, order) => {
    if (order.status) acc[order.status] = (acc[order.status] ?? 0) + 1;
    return acc;
  }, {});

  const paymentStatusCounts = items.reduce<Record<string, number>>(
    (acc, order) => {
      if (order.rentalPaymentStatus) {
        acc[order.rentalPaymentStatus] =
          (acc[order.rentalPaymentStatus] ?? 0) + 1;
      }
      return acc;
    },
    {}
  );

  const totalAmount = items.reduce(
    (sum, order) => sum + Number(order.totalAmount ?? 0),
    0
  );

  return JSON.stringify(
    {
      count: items.length,
      totalAmount,
      statusCounts,
      paymentStatusCounts,
      nextCursor: root ? getRecordString(root, 'nextCursor') : undefined,
      items,
    },
    null,
    2
  );
}

=======
>>>>>>> origin/dev
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
<<<<<<< HEAD
      description:
        'Convert stock items into rentable units. For source metadata, pass input JSON with rentalItemId, quantity, optional sourceOrderId/sourceFulfillmentId/sourceBillId/sourceBatchCode/unitCodes/unitMetadata.',
=======
      description: 'Convert stock items into rentable units',
>>>>>>> origin/dev
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
<<<<<<< HEAD
          input: {
            type: 'string',
            description:
              'Optional JSON payload for all convertStock fields. Overrides individual fields.',
          },
          rentalItemId: { type: 'string', description: 'Rental item UUID' },
          quantity: { type: 'number', description: 'Number of units to create' },
          sourceOrderId: { type: 'string', description: 'Source PO UUID' },
          sourceOrderItemId: {
            type: 'string',
            description: 'Source PO item UUID',
          },
          sourceFulfillmentId: {
            type: 'string',
            description: 'Source GRN/receipt UUID',
          },
          sourceBillId: { type: 'string', description: 'Source bill UUID' },
          sourceBatchCode: {
            type: 'string',
            description: 'Human import/acquisition batch code',
          },
        },
        required: ['companyId'],
      },
      handler: async (args) => {
        const rawInput = getOptionalString(args, 'input');
        const parsedInput = rawInput
          ? (JSON.parse(rawInput) as Record<string, unknown>)
          : undefined;
        const quantity = args.quantity;
        const fallbackInput = buildInput([
          ['rentalItemId', getOptionalString(args, 'rentalItemId')],
          ['quantity', typeof quantity === 'number' ? quantity : undefined],
          ['sourceOrderId', getOptionalString(args, 'sourceOrderId')],
          ['sourceOrderItemId', getOptionalString(args, 'sourceOrderItemId')],
          ['sourceFulfillmentId', getOptionalString(args, 'sourceFulfillmentId')],
          ['sourceBillId', getOptionalString(args, 'sourceBillId')],
          ['sourceBatchCode', getOptionalString(args, 'sourceBatchCode')],
        ]);
        return apiMutation(
          'rental.items.convertStock',
          parsedInput ?? fallbackInput,
          getString(args, 'companyId')
        );
      },
=======
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
>>>>>>> origin/dev
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
<<<<<<< HEAD
            description: 'Order lifecycle status, not payment status.',
            enum: ['DRAFT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
          },
          rentalPaymentStatus: {
            type: 'string',
            description:
              'Client-side payment status filter. Use this instead of status when looking for unpaid, awaiting confirmation, confirmed, or failed rental payments.',
            enum: ['PENDING', 'AWAITING_CONFIRM', 'CONFIRMED', 'FAILED'],
          },
          partnerId: { type: 'string', description: 'Filter by partner' },
          take: {
            type: 'number',
            description: 'Maximum orders to return; defaults to API limit.',
            minimum: 1,
            maximum: 200,
          },
          cursor: {
            type: 'string',
            description: 'Pagination cursor from a previous response.',
          },
          notesContains: {
            type: 'string',
            description:
              'Client-side filter for order notes. Use with compact=true for import refs such as invoice_ref=.',
          },
          compact: {
            type: 'boolean',
            description:
              'Return compact order summaries instead of full order relations to reduce agent context.',
            default: false,
          },
        },
        required: ['companyId'],
      },
      handler: async (args) => {
        const response = await apiQuery(
=======
            enum: ['DRAFT', 'PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
          },
          partnerId: { type: 'string', description: 'Filter by partner' },
        },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery(
>>>>>>> origin/dev
          'rental.orders.list',
          buildInput([
            ['status', getOptionalString(args, 'status')],
            ['partnerId', getOptionalString(args, 'partnerId')],
<<<<<<< HEAD
            ['take', getOptionalNumber(args, 'take')],
            ['cursor', getOptionalString(args, 'cursor')],
          ]),
          getString(args, 'companyId')
        );
        const compact = getOptionalBoolean(args, 'compact') ?? false;
        const notesContains = getOptionalString(args, 'notesContains');
        const rentalPaymentStatus = getOptionalString(args, 'rentalPaymentStatus');
        return compact || notesContains || rentalPaymentStatus
          ? compactRentalOrderList(response, notesContains, rentalPaymentStatus)
          : response;
      },
=======
          ]),
          getString(args, 'companyId')
        ),
>>>>>>> origin/dev
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
<<<<<<< HEAD
        'Create a rental order. Input JSON: {partnerId, rentalStartDate, rentalEndDate, items: [{rentalItemId|rentalBundleId, quantity, pricePerDay?, lineTotal?}], deliveryFee?, discountAmount?, notes?}. Use source invoice pricePerDay/lineTotal and deliveryFee when historical or package pricing differs from master rates. Use lineTotal when the invoice has an exact line subtotal that should not be re-derived from a daily rate.',
=======
        'Create a rental order. Input JSON: {partnerId, startDate, endDate, items: [{rentalItemId, quantity}], notes?}',
>>>>>>> origin/dev
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
<<<<<<< HEAD
      description:
        'Extend rental order items or record a historical late-return extension. Input JSON: {orderId, newEndDate, items?: [{rentalOrderItemId|rentalItemId|rentalBundleId, quantity?, unitPrice?, additionalAmount?, notes?}], reason?, additionalAmount?, deliveryFee?, deliveryFeeLabel?, additionalDeposit?, isPaid?, paidAt?, paymentId?, businessDate?, allowHistorical?, updateOrderTotal?, updateOrderDates?}. Use items[] for partial/per-item extensions; use per-item additionalAmount for exact historical invoice or source item totals, and deliveryFee for extra delivery/pickup charges.',
=======
      description: 'Extend a rental order. Input JSON: {orderId, newEndDate, reason?}',
>>>>>>> origin/dev
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
<<<<<<< HEAD
          input: {
            type: 'string',
            description:
              'JSON: {orderId, newEndDate, items?: [{rentalOrderItemId|rentalItemId|rentalBundleId, quantity?, unitPrice?, additionalAmount?, notes?}], reason?, additionalAmount?, deliveryFee?, deliveryFeeLabel?, additionalDeposit?, isPaid?, paidAt?, paymentId?, businessDate?, allowHistorical?, updateOrderTotal?, updateOrderDates?}',
          },
=======
          input: { type: 'string', description: 'JSON: {orderId, newEndDate, reason?}' },
>>>>>>> origin/dev
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
<<<<<<< HEAD
    {
      name: 'rental_order_settle_historical_completed',
      description:
        'Backfill a finished historical rental order as completed and paid. This posts rental revenue on paymentDate without assigning/reserving units. Input JSON: {orderId, paymentDate, completedAt?, paymentMethod?, paymentReference?, notes?}. Use only for rental periods that already ended.',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          input: {
            type: 'string',
            description:
              'JSON: {orderId, paymentDate ISO, completedAt ISO?, paymentMethod?, paymentReference?, notes?}',
          },
        },
        required: ['companyId', 'input'],
      },
      handler: async (args) => {
        const input: unknown = JSON.parse(getString(args, 'input'));
        return apiMutation(
          'rental.orders.settleHistoricalCompleted',
          input as Record<string, unknown>,
          getString(args, 'companyId')
        );
      },
    },
=======
>>>>>>> origin/dev

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
