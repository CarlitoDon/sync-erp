import { z } from 'zod';
import { RentalPaymentMethodSchema } from './base.js';

// ==========================================
// Order Extension
// ==========================================

export const ExtendRentalOrderItemSchema = z
  .object({
    rentalOrderItemId: z.string().uuid().optional(),
    rentalItemId: z.string().uuid().optional(),
    rentalBundleId: z.string().uuid().optional(),
    quantity: z.number().int().positive().optional(),
    unitPrice: z.number().nonnegative().optional(),
    additionalAmount: z.number().nonnegative().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) =>
      !!data.rentalOrderItemId ||
      !!data.rentalItemId ||
      !!data.rentalBundleId,
    {
      message:
        'Either rentalOrderItemId, rentalItemId, or rentalBundleId is required',
      path: ['rentalOrderItemId'],
    }
  );
export type ExtendRentalOrderItemInput = z.infer<
  typeof ExtendRentalOrderItemSchema
>;

export const ExtendRentalOrderPaymentSchema = z.object({
  amount: z.number().nonnegative(),
  paymentMethod: RentalPaymentMethodSchema.default('BANK'),
  paymentAccountId: z.string().uuid().optional(),
});
export type ExtendRentalOrderPaymentInput = z.infer<
  typeof ExtendRentalOrderPaymentSchema
>;

export const ExtendRentalOrderSchema = z
  .object({
    orderId: z.string().uuid(),
    newEndDate: z.union([
      z.date(),
      z.string().datetime().transform((str) => new Date(str)),
    ]),
    additionalAmount: z.number().nonnegative().optional(),
    /**
     * Biaya Tambahan Armada (extra fleet trip fee for rental extension delivery/collection).
     */
    deliveryFee: z.number().nonnegative().optional(),
    /**
     * Optional label for delivery fee. Defaults to 'Biaya Tambahan Armada' in UI and services.
     */
    deliveryFeeLabel: z.string().optional(),
    additionalDeposit: z.number().nonnegative().optional(),
    items: z.array(ExtendRentalOrderItemSchema).min(1).optional(),
    /**
     * Optional physical unit IDs to extend (for partial unit extensions).
     */
    unitIds: z.array(z.string().uuid()).optional(),
    /**
     * Integrated Extension Payment.
     */
    payment: ExtendRentalOrderPaymentSchema.optional(),
    reason: z.string().optional(),
    notes: z.string().optional(),
    isPaid: z.boolean().optional(),
    paidAt: z
      .union([
        z.date(),
        z.string().datetime().transform((str) => new Date(str)),
      ])
      .optional(),
    paymentId: z.string().uuid().optional(),
    businessDate: z
      .union([
        z.date(),
        z.string().datetime().transform((str) => new Date(str)),
      ])
      .optional(),
    allowHistorical: z.boolean().optional(),
    updateOrderTotal: z.boolean().optional(),
    updateOrderDates: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.items && data.additionalAmount !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['additionalAmount'],
        message: 'Use per-item additionalAmount when items are provided',
      });
    }
  });

export type ExtendRentalOrderInput = z.infer<
  typeof ExtendRentalOrderSchema
>;
