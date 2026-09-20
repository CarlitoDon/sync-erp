import { z } from 'zod';
import {
  RentalOrderSchema,
  RentalOrderItemSchema as GeneratedRentalOrderItemSchema,
  PartnerSchema,
  RentalOrderUnitAssignmentSchema,
  RentalItemUnitSchema,
  RentalOrderExtensionSchema as GeneratedRentalOrderExtensionSchema,
  RentalOrderExtensionItemSchema as GeneratedRentalOrderExtensionItemSchema,
  RentalReturnSchema as GeneratedRentalReturnSchema,
} from '../../generated/zod/index.js';
import { RentalPaymentMethodSchema } from './base.js';
import { RentalItemWithRelationsSchema } from './item.js';

// ==========================================
// Rental Order Booking & Relations
// ==========================================

const RentalOrderExtensionWithItemsSchema =
  GeneratedRentalOrderExtensionSchema.extend({
    items: z.array(GeneratedRentalOrderExtensionItemSchema).optional(),
  });

export const RentalOrderWithRelationsSchema =
  RentalOrderSchema.extend({
    items: z.array(
      GeneratedRentalOrderItemSchema.extend({
        rentalItem:
          RentalItemWithRelationsSchema.nullable().optional(),
        rentalBundle: z
          .object({
            id: z.string(),
            name: z.string(),
            shortName: z.string().nullable().optional(),
            components: z
              .array(
                z.object({
                  id: z.string(),
                  quantity: z.number(),
                  rentalItem: z
                    .object({
                      id: z.string(),
                      product: z
                        .object({
                          id: z.string(),
                          name: z.string(),
                        })
                        .nullable()
                        .optional(),
                    })
                    .nullable()
                    .optional(),
                })
              )
              .optional(),
          })
          .nullable()
          .optional(),
      })
    ),
    partner: PartnerSchema,
    extensions: z.array(RentalOrderExtensionWithItemsSchema).optional(),
    unitAssignments: z.array(
      RentalOrderUnitAssignmentSchema.extend({
        rentalItemUnit: RentalItemUnitSchema.extend({
          rentalItem: RentalItemWithRelationsSchema.optional(),
        }).optional(),
      })
    ),
    return: GeneratedRentalReturnSchema.nullable().optional(),
  });

export type RentalOrderWithRelations = z.infer<
  typeof RentalOrderWithRelationsSchema
>;

const RentalOrderItemSchema = z
  .object({
    rentalItemId: z.string().uuid().optional(),
    rentalBundleId: z.string().uuid().optional(),
    quantity: z.number().int().positive(),
    pricePerDay: z.number().positive().optional(),
    lineTotal: z.number().positive().optional(),
  })
  .refine((data) => !!data.rentalItemId || !!data.rentalBundleId, {
    message: 'Either rentalItemId or rentalBundleId is required',
  });

export const CreateRentalOrderSchema = z
  .object({
    partnerId: z.string().uuid(),
    rentalStartDate: z
      .string()
      .datetime()
      .transform((str) => new Date(str)),
    rentalEndDate: z
      .string()
      .datetime()
      .transform((str) => new Date(str)),
    dueDateTime: z
      .string()
      .datetime()
      .transform((str) => new Date(str))
      .optional(),
    items: z.array(RentalOrderItemSchema).min(1),
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
    paymentMethod: z.string().optional(),
    discountAmount: z.number().nonnegative().optional(),
    discountLabel: z.string().optional(),
  })
  .refine(
    (data) => {
      return data.rentalEndDate > data.rentalStartDate;
    },
    {
      message: 'Rental end date must be after start date',
      path: ['rentalEndDate'],
    }
  );

export type CreateRentalOrderInput = z.infer<
  typeof CreateRentalOrderSchema
>;

export const CancelRentalRefundPaymentSchema = z.object({
  amount: z.number().nonnegative(),
  paymentAccountId: z.string().uuid().optional(),
  paymentMethod: RentalPaymentMethodSchema.optional(),
});
export type CancelRentalRefundPaymentInput = z.infer<
  typeof CancelRentalRefundPaymentSchema
>;

export const CancelRentalOrderSchema = z.object({
  orderId: z.string().uuid(),
  /**
   * Cancellation reason for audit trail (min 5 chars).
   */
  reason: z.string().min(5, 'Cancellation reason required'),
  /**
   * Optional DP refund payment. When provided, posts reversal journal
   * (Debet Uang Muka Sewa 2200, Kredit Kas/Bank) per FR-020.
   */
  refundPayment: CancelRentalRefundPaymentSchema.optional(),
});

export type CancelRentalOrderInput = z.infer<
  typeof CancelRentalOrderSchema
>;
