import { z } from 'zod';
import { RentalPaymentMethodSchema } from './base.js';

// ==========================================
// Returns & Settlement
// ==========================================

export const UnitReturnSchema = z.object({
  unitId: z.string().uuid(),
  afterPhotos: z.array(z.string()).default([]),
  condition: z
    .enum(['NEW', 'GOOD', 'FAIR', 'NEEDS_REPAIR'])
    .optional()
    .default('GOOD'),
  conditionStatus: z.enum(['GOOD', 'DIRTY', 'DAMAGED']).optional(),
  damageSeverity: z.enum(['MINOR', 'MAJOR', 'UNUSABLE']).optional(),
  damageNotes: z.string().optional(),
  notes: z.string().optional(),
});
export type UnitReturnInput = z.infer<typeof UnitReturnSchema>;

export const ReturnDamagePaymentSchema = z.object({
  amount: z.number().nonnegative(),
  paymentMethod: RentalPaymentMethodSchema.default('CASH'),
  paymentAccountId: z.string().uuid().optional(),
  notes: z.string().optional(),
});
export type ReturnDamagePaymentInput = z.infer<
  typeof ReturnDamagePaymentSchema
>;

export const ProcessReturnSchema = z
  .object({
    orderId: z.string().uuid(),
    actualReturnDate: z
      .union([
        z.date(),
        z.string().datetime().transform((str) => new Date(str)),
      ])
      .default(() => new Date()),
    returnDate: z
      .union([
        z.date(),
        z.string().datetime().transform((str) => new Date(str)),
      ])
      .optional(),
    units: z.array(UnitReturnSchema).default([]),
    unitReturns: z.array(UnitReturnSchema).optional(),
    // On-the-spot damage/cleaning payment
    damagePayment: ReturnDamagePaymentSchema.optional(),
  })
  .refine(
    (data) =>
      (data.units && data.units.length > 0) ||
      (data.unitReturns && data.unitReturns.length > 0),
    {
      message: 'At least one unit must be returned',
      path: ['units'],
    }
  );

export type ProcessReturnInput = z.infer<typeof ProcessReturnSchema>;

export const FinalizeReturnSchema = z.object({
  returnId: z.string().uuid(),
  // Optional adjustments before finalizing
  damageChargesOverride: z.number().nonnegative().optional(),
  cleaningFeesOverride: z.number().nonnegative().optional(),
  otherCharges: z.number().nonnegative().optional(),
  settlementNotes: z.string().optional(),
});

export type FinalizeReturnInput = z.infer<
  typeof FinalizeReturnSchema
>;

export const CreateInvoiceFromReturnSchema = z.object({
  returnId: z.string().uuid(),
  dueDate: z
    .string()
    .datetime()
    .transform((str) => new Date(str)),
  notes: z.string().optional(),
});

export type CreateInvoiceFromReturnInput = z.infer<
  typeof CreateInvoiceFromReturnSchema
>;

export interface RentalReturnResponse {
  id: string;
  rentalOrderId: string;
  actualReturnDate: string;
  baseRentalFee: number;
  lateFee: number;
  damageCharges: number;
  cleaningFees: number;
  otherCharges: number;
  totalCharges: number;
  depositApplied: number;
  balanceDue: number;
  balanceRefund: number;
  status: 'DRAFT' | 'SETTLED';
  settledAt?: string;
}
