import { z } from 'zod';

export const RentalIntegrationPaymentMethodSchema = z.enum([
  'qris',
  'transfer',
  'gopay',
]);

export const RentalIntegrationCustomerSchema = z.object({
  companyId: z.string().min(1).optional(),
  name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  address: z.string().optional(),
  street: z.string().optional(),
  kelurahan: z.string().optional(),
  kecamatan: z.string().optional(),
  kota: z.string().optional(),
  provinsi: z.string().optional(),
  zip: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  externalId: z.string().optional(),
  externalSource: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const RentalIntegrationOrderItemSchema = z
  .object({
    rentalItemId: z.string().min(1).optional(),
    rentalBundleId: z.string().min(1).optional(),
    quantity: z.number().int().positive(),
    name: z.string().optional(),
    pricePerDay: z.number().positive().optional(),
    category: z.enum(['package', 'mattress', 'accessory']).optional(),
    components: z.array(z.string()).optional(),
  })
  .refine((data) => !!data.rentalItemId || !!data.rentalBundleId, {
    message: 'Either rentalItemId or rentalBundleId is required',
  });

export const RentalIntegrationCreateOrderSchema = z.object({
  companyId: z.string().min(1).optional(),
  partnerId: z.string().min(1),
  rentalStartDate: z.coerce.date(),
  rentalEndDate: z.coerce.date(),
  items: z.array(RentalIntegrationOrderItemSchema).min(1),
  notes: z.string().optional(),
  deliveryFee: z.number().nonnegative().optional(),
  deliveryAddress: z.string().optional(),
  street: z.string().optional(),
  kelurahan: z.string().optional(),
  kecamatan: z.string().optional(),
  kota: z.string().optional(),
  provinsi: z.string().optional(),
  zip: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  paymentMethod: RentalIntegrationPaymentMethodSchema.optional(),
  discountAmount: z.number().nonnegative().optional(),
  discountLabel: z.string().optional(),
  externalId: z.string().optional(),
  externalSource: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const RentalIntegrationUpdateOrderSchema = z.object({
  token: z.string().uuid().optional(),
  id: z.string().uuid().optional(),
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().optional(),
  rentalStartDate: z.coerce.date().optional(),
  rentalEndDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  deliveryFee: z.number().nonnegative().optional(),
  deliveryAddress: z.string().optional(),
  street: z.string().optional(),
  kelurahan: z.string().optional(),
  kecamatan: z.string().optional(),
  kota: z.string().optional(),
  provinsi: z.string().optional(),
  zip: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  paymentMethod: RentalIntegrationPaymentMethodSchema.optional(),
  discountAmount: z.number().nonnegative().optional(),
  discountLabel: z.string().optional(),
  items: z.array(RentalIntegrationOrderItemSchema).optional(),
});

export const RentalIntegrationCancelOrderSchema = z.object({
  reason: z.string().optional(),
});

export const RentalIntegrationClaimPaymentSchema = z.object({
  token: z.string().uuid(),
  paymentMethod: RentalIntegrationPaymentMethodSchema,
  reference: z.string().optional(),
});

export const RentalIntegrationConfirmPaymentSchema = z.object({
  orderNumber: z.string().min(1),
  paymentMethod: z.string().min(1),
  transactionId: z.string().optional(),
  amount: z.number().optional(),
});

export const RentalIntegrationRejectPaymentSchema = z.object({
  orderNumber: z.string().min(1),
  paymentMethod: z.string().optional(),
  failReason: z.string().min(1),
});

export type RentalIntegrationCustomerInput = z.infer<
  typeof RentalIntegrationCustomerSchema
>;
export type RentalIntegrationCreateOrderInput = z.infer<
  typeof RentalIntegrationCreateOrderSchema
>;
export type RentalIntegrationUpdateOrderInput = z.infer<
  typeof RentalIntegrationUpdateOrderSchema
>;
export type RentalIntegrationClaimPaymentInput = z.infer<
  typeof RentalIntegrationClaimPaymentSchema
>;
export type RentalIntegrationConfirmPaymentInput = z.infer<
  typeof RentalIntegrationConfirmPaymentSchema
>;
export type RentalIntegrationRejectPaymentInput = z.infer<
  typeof RentalIntegrationRejectPaymentSchema
>;
