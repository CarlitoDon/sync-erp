import { z } from 'zod';
import { RentalPaymentMethodSchema } from './base.js';

// ==========================================
// Order Confirmation & Settlement
// ==========================================

export const UnitAssignmentInputSchema = z.object({
  unitId: z.string().uuid(),
});
export type UnitAssignmentInput = z.infer<
  typeof UnitAssignmentInputSchema
>;

// Simplified: Admin just confirms, deposit is pre-calculated
export const ConfirmRentalOrderSchema = z.object({
  orderId: z.string().uuid(),
  /**
   * Down Payment (DP ~30%) paid by customer upon confirmation.
   * Stored in RentalOrder.depositAmount for database backward compatibility.
   * Optional: falls back to pre-calculated order.depositAmount if omitted.
   */
  depositAmount: z.number().nonnegative().optional(),
  /**
   * Payment method used for Down Payment (CASH, BANK, QRIS).
   */
  paymentMethod: z.union([RentalPaymentMethodSchema, z.string()]).optional(),
  /**
   * Destination Cash/Bank account ID (UUID) for double-entry DP journal posting.
   */
  paymentAccountId: z.string().uuid().optional(),
  paymentReference: z.string().optional(),
  /**
   * Optional physical unit assignments. If not provided, units will be auto-assigned.
   */
  unitAssignments: z
    .array(UnitAssignmentInputSchema)
    .optional()
    .default([]),
});

export type ConfirmRentalOrderInput = z.infer<
  typeof ConfirmRentalOrderSchema
>;

export const ManualConfirmAccountingTreatmentSchema = z.enum([
  'POST_CASH_JOURNAL',
  'OPENING_BALANCE_NO_POSTING',
]);
export type ManualConfirmAccountingTreatment = z.infer<
  typeof ManualConfirmAccountingTreatmentSchema
>;

// Manual confirm for admin to override stock/payment checks
export const ManualConfirmRentalOrderSchema = z
  .object({
    orderId: z.string().uuid(),
    // Override flags
    skipStockCheck: z.boolean().default(false),
    // Payment info
    paymentMethodId: z.string().uuid(), // From CompanyPaymentMethod
    paymentAmount: z.number().nonnegative(),
    /**
     * Down Payment (DP ~30%) collected for manual confirmation.
     * Stored in RentalOrder.depositAmount for database backward compatibility.
     */
    depositAmount: z.number().nonnegative().optional(),
    paymentMethod: RentalPaymentMethodSchema.optional(),
    paymentAccountId: z.string().uuid().optional(),
    paymentReference: z.string().optional(),
    // Accounting treatment
    accountingTreatment: ManualConfirmAccountingTreatmentSchema.default(
      'POST_CASH_JOURNAL'
    ),
    // Notes or reason for audit trail
    notes: z
      .string()
      .min(5, 'Notes required for manual confirmation')
      .optional(),
    reason: z
      .string()
      .min(5, 'Alasan konfirmasi manual harus diisi')
      .optional(),
  })
  .refine((data) => Boolean(data.notes || data.reason), {
    message: 'Notes or reason required for manual confirmation',
    path: ['notes'],
  });

export type ManualConfirmRentalOrderInput = z.infer<
  typeof ManualConfirmRentalOrderSchema
>;

export const HistoricalRentalSettlementSchema = z.object({
  orderId: z.string().uuid(),
  paymentDate: z
    .string()
    .datetime()
    .transform((str) => new Date(str)),
  completedAt: z
    .string()
    .datetime()
    .transform((str) => new Date(str))
    .optional(),
  paymentMethod: z
    .enum(['CASH', 'BANK', 'QRIS', 'EWALLET', 'OTHER'])
    .default('BANK'),
  paymentReference: z.string().trim().min(1).max(120).optional(),
  notes: z.string().trim().min(5).max(1000).optional(),
});

export type HistoricalRentalSettlementInput = z.infer<
  typeof HistoricalRentalSettlementSchema
>;
