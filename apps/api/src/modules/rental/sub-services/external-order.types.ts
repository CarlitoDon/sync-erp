import { Prisma } from '@sync-erp/database';

export interface OrderItemComponent {
  quantity: number;
  label: string;
}

export interface CreatePublicOrderInput {
  companyId: string;
  partnerId: string;
  rentalStartDate: Date;
  rentalEndDate: Date;
  items: {
    rentalItemId?: string;
    rentalBundleId?: string;
    quantity: number;
    name?: string;
    pricePerDay?: number;
    lineTotal?: number;
    category?: 'package' | 'mattress' | 'accessory';
    components?: string[] | OrderItemComponent[];
  }[];
  notes?: string;
  deliveryFee?: number;
  deliveryAddress?: string;
  street?: string;
  kelurahan?: string;
  kecamatan?: string;
  kota?: string;
  provinsi?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  paymentMethod?: string;
  discountAmount?: number;
  discountLabel?: string;
  externalId?: string;
  externalSource?: string;
  metadata?: Record<string, unknown>;
  createdByApiKeyId?: string;
  integrationId?: string;
  createdBy?: string;
  skuPrefix?: string;
}

export interface UpdatePublicOrderInput {
  token: string;
  customerName?: string;
  customerPhone?: string;
  rentalStartDate?: Date;
  rentalEndDate?: Date;
  notes?: string;
  deliveryFee?: number;
  deliveryAddress?: string;
  street?: string;
  kelurahan?: string;
  kecamatan?: string;
  kota?: string;
  provinsi?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  paymentMethod?: string;
  discountAmount?: number;
  discountLabel?: string;
  items?: {
    rentalItemId?: string;
    rentalBundleId?: string;
    quantity: number;
    name?: string;
    pricePerDay?: number;
    lineTotal?: number;
    category?: 'package' | 'mattress' | 'accessory';
    components?: string[] | OrderItemComponent[];
  }[];
}

export type ExternalOrderItemInput = CreatePublicOrderInput['items'][number];

export type ResolvedOrderItem = {
  rentalItemId?: string;
  rentalBundleId?: string;
  quantity: number;
  unitPrice: Prisma.Decimal | number;
  subtotal: Prisma.Decimal | number;
  pricingTier: 'DAILY' | 'CUSTOM';
};

export type RateBearingRecord = {
  id: string;
  dailyRate: Prisma.Decimal;
};

export const RENTAL_ORDER_INCLUDE = {
  partner: {
    select: {
      name: true,
      phone: true,
      address: true,
      street: true,
      kelurahan: true,
      kecamatan: true,
      kota: true,
      provinsi: true,
      zip: true,
      latitude: true,
      longitude: true,
    },
  },
  items: {
    include: {
      rentalItem: {
        include: {
          product: {
            select: {
              name: true,
              sku: true,
            },
          },
        },
      },
      rentalBundle: {
        select: {
          name: true,
          shortName: true,
        },
      },
    },
  },
} as const;
