import { z } from 'zod';
import { RentalPaymentMethodSchema } from './base.js';

// ==========================================
// Unit Release & Dispatch
// ==========================================

export const UnitReleaseInputSchema = z.object({
  unitId: z.string().uuid(),
  beforePhotos: z.array(z.string()).default([]),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'NEEDS_REPAIR']),
  notes: z.string().optional(),
});
export type UnitReleaseInput = z.infer<typeof UnitReleaseInputSchema>;

export const UnitReleaseSchema = UnitReleaseInputSchema;
export type UnitRelease = UnitReleaseInput;

export const ReleasePaymentSchema = z.object({
  /**
   * Remaining rental settlement amount (~70% balance plus ongkir) paid upon delivery.
   */
  settlementAmount: z.number().nonnegative(),
  /**
   * Payment method used for settlement (CASH, BANK, QRIS). Defaults to CASH for delivery.
   */
  paymentMethod: RentalPaymentMethodSchema.default('CASH'),
  /**
   * Destination Cash/Bank account ID (UUID) for double-entry settlement journal posting.
   */
  paymentAccountId: z.string().uuid().optional(),
  reference: z.string().optional(),
});
export type ReleasePaymentInput = z.infer<typeof ReleasePaymentSchema>;

export const ReleaseRentalOrderSchema = z.object({
  orderId: z.string().uuid(),
  unitAssignments: z.array(UnitReleaseInputSchema).min(1),
  skipPhotoCheck: z.boolean().optional(),
  /**
   * Integrated Settlement Payment (70% balance upon delivery).
   */
  payment: ReleasePaymentSchema.optional(),
});

export type ReleaseRentalOrderInput = z.infer<
  typeof ReleaseRentalOrderSchema
>;
