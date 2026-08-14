import type { Prisma } from '@sync-erp/database';

type DecimalLike = Prisma.Decimal | number | null;

type IntegrationOrderPartner = {
  name: string;
  phone: string | null;
  address: string | null;
  street: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  kota: string | null;
  provinsi: string | null;
  zip: string | null;
  latitude: DecimalLike;
  longitude: DecimalLike;
};

type IntegrationOrderItem = {
  rentalItemId?: string | null;
  rentalBundleId?: string | null;
  quantity: number;
  unitPrice: DecimalLike;
  subtotal: DecimalLike;
  rentalItem?: {
    product?: {
      name: string;
      sku: string;
    } | null;
  } | null;
  rentalBundle?: {
    name: string;
    shortName?: string | null;
  } | null;
};

type IntegrationOrder = {
  id: string;
  orderNumber: string;
  status: string;
  publicToken: string | null;
  rentalStartDate: Date;
  rentalEndDate: Date;
  subtotal: DecimalLike;
  totalAmount: DecimalLike;
  depositAmount: DecimalLike;
  notes: string | null;
  createdAt: Date;
  updatedAt?: Date;
  deliveryFee: DecimalLike;
  deliveryAddress: string | null;
  street: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  kota: string | null;
  provinsi: string | null;
  zip: string | null;
  latitude: DecimalLike;
  longitude: DecimalLike;
  paymentMethod: string | null;
  discountAmount: DecimalLike;
  discountLabel: string | null;
  orderSource: string;
  rentalPaymentStatus: string;
  paymentClaimedAt: Date | null;
  paymentConfirmedAt: Date | null;
  paymentReference: string | null;
  paymentFailedAt: Date | null;
  paymentFailReason: string | null;
  partner: IntegrationOrderPartner;
  items: IntegrationOrderItem[];
};

const decimalToNumber = (value: DecimalLike) => {
  if (value === null) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toNumber' in value &&
    typeof value.toNumber === 'function'
  ) {
    const numeric = value.toNumber();
    return Number.isFinite(numeric) ? numeric : 0;
  }

  return 0;
};

export const toIntegrationCustomerDto = (customer: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  street: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  kota: string | null;
  provinsi: string | null;
  zip: string | null;
  latitude: DecimalLike;
  longitude: DecimalLike;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: customer.id,
  name: customer.name,
  phone: customer.phone,
  email: customer.email,
  address: customer.address,
  street: customer.street,
  kelurahan: customer.kelurahan,
  kecamatan: customer.kecamatan,
  kota: customer.kota,
  provinsi: customer.provinsi,
  zip: customer.zip,
  latitude: decimalToNumber(customer.latitude),
  longitude: decimalToNumber(customer.longitude),
  createdAt: customer.createdAt,
  updatedAt: customer.updatedAt,
});

export const toIntegrationOrderSummaryDto = (order: {
  id: string;
  orderNumber: string;
  publicToken: string | null;
  status: string;
  rentalPaymentStatus?: string;
  totalAmount?: DecimalLike;
  createdAt: Date;
}) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  publicToken: order.publicToken || order.id,
  status: order.status,
  rentalPaymentStatus: order.rentalPaymentStatus,
  totalAmount:
    order.totalAmount === undefined
      ? undefined
      : decimalToNumber(order.totalAmount),
  createdAt: order.createdAt,
});

/**
 * DTO for the public order-tracking endpoint (`GET /rental/orders/by-token`).
 *
 * Deliberately minimal: the token is a bearer credential shared with an
 * external storefront, so this response contains only tracking status and
 * totals. PII (customer identity, full address, payment reference, failure
 * reason) and internal identifiers are omitted; partner is reduced to a
 * display name. This is the minimization boundary for public order tokens.
 */
export const toIntegrationOrderDto = (order: IntegrationOrder) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  status: order.status,
  publicToken: order.publicToken || order.id,
  rentalStartDate: order.rentalStartDate,
  rentalEndDate: order.rentalEndDate,
  subtotal: decimalToNumber(order.subtotal),
  totalAmount: decimalToNumber(order.totalAmount),
  depositAmount: decimalToNumber(order.depositAmount),
  notes: order.notes,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  deliveryFee: decimalToNumber(order.deliveryFee),
  deliveryAddress: order.deliveryAddress,
  paymentMethod: order.paymentMethod,
  discountAmount: decimalToNumber(order.discountAmount),
  discountLabel: order.discountLabel,
  orderSource: order.orderSource,
  rentalPaymentStatus: order.rentalPaymentStatus,
  paymentClaimedAt: order.paymentClaimedAt,
  paymentConfirmedAt: order.paymentConfirmedAt,
  partner: {
    name: order.partner.name,
  },
  items: order.items.map((item) => ({
    rentalItemId: item.rentalItemId,
    rentalBundleId: item.rentalBundleId,
    name:
      item.rentalItem?.product?.name ||
      item.rentalBundle?.name ||
      'Unknown',
    quantity: item.quantity,
    unitPrice: decimalToNumber(item.unitPrice),
    subtotal: decimalToNumber(item.subtotal),
  })),
});
