/**
 * Rental Order Lifecycle API Contracts
 * Feature: 045-rental-flow-alignment
 *
 * Single Source of Truth for Zod schemas in @sync-erp/shared (packages/shared/src/validators/rental.ts)
 * Note: Canonical schemas are updated in-place without duplicate "*ContractSchema" naming.
 */

import { z } from 'zod';

// ==========================================
// 1. Confirm Order (DP & Serial Locking)
// ==========================================
export const UnitAssignmentInputSchema = z.object({
  unitId: z.string().uuid(),
});

export const ConfirmRentalOrderSchema = z.object({
  orderId: z.string().uuid(),
  /**
   * Down Payment (DP ~30%) paid by customer upon confirmation.
   * Stored in RentalOrder.depositAmount for database backward compatibility.
   */
  depositAmount: z.number().nonnegative(),
  paymentMethod: z.enum(['CASH', 'BANK', 'QRIS']).default('BANK'),
  paymentAccountId: z.string().uuid().optional(),
  unitAssignments: z.array(UnitAssignmentInputSchema).optional(),
});

export type ConfirmRentalOrderInput = z.infer<typeof ConfirmRentalOrderSchema>;

// Fallback for stock shortage (FR-004)
export const ManualConfirmRentalOrderSchema = z.object({
  orderId: z.string().uuid(),
  skipStockCheck: z.boolean().default(false),
  paymentMethodId: z.string().uuid(),
  paymentAmount: z.number().nonnegative(),
  paymentReference: z.string().optional(),
  accountingTreatment: z.enum(['POST_CASH_JOURNAL', 'OPENING_BALANCE_NO_POSTING']).default('POST_CASH_JOURNAL'),
  reason: z.string().min(5, 'Alasan konfirmasi manual harus diisi'),
});

export type ManualConfirmRentalOrderInput = z.infer<typeof ManualConfirmRentalOrderSchema>;

// ==========================================
// 2. Release Units (Serah Terima & Pelunasan 70%)
// ==========================================
export const UnitReleaseInputSchema = z.object({
  unitId: z.string().uuid(),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'NEEDS_REPAIR']),
  beforePhotos: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const ReleaseRentalOrderSchema = z.object({
  orderId: z.string().uuid(),
  unitAssignments: z.array(UnitReleaseInputSchema).min(1),
  skipPhotoCheck: z.boolean().optional(),
  // Integrated Settlement Payment (70% balance upon delivery)
  payment: z.object({
    settlementAmount: z.number().nonnegative(),
    paymentMethod: z.enum(['CASH', 'BANK', 'QRIS']).default('CASH'),
    paymentAccountId: z.string().uuid().optional(),
    reference: z.string().optional(),
  }).optional(),
});

export type ReleaseRentalOrderInput = z.infer<typeof ReleaseRentalOrderSchema>;

// ==========================================
// 3. Extension (Full & Partial with Fleet Fee)
// ==========================================
export const ExtendRentalOrderItemSchema = z.object({
  rentalOrderItemId: z.string().uuid().optional(),
  rentalItemId: z.string().uuid().optional(),
  quantity: z.number().int().positive().optional(),
  unitPrice: z.number().nonnegative().optional(),
  additionalAmount: z.number().nonnegative().optional(),
});

export const ExtendRentalOrderSchema = z.object({
  orderId: z.string().uuid(),
  newEndDate: z.string().datetime().transform((str) => new Date(str)),
  additionalAmount: z.number().nonnegative().optional(),
  deliveryFee: z.number().nonnegative().optional(), // Biaya Tambahan Armada (extra fleet trip fee)
  deliveryFeeLabel: z.string().optional().default('Biaya Tambahan Armada'),
  items: z.array(ExtendRentalOrderItemSchema).min(1).optional(),
  payment: z.object({
    amount: z.number().nonnegative(),
    paymentMethod: z.enum(['CASH', 'BANK', 'QRIS']).default('BANK'),
    paymentAccountId: z.string().uuid().optional(),
  }).optional(),
});

export type ExtendRentalOrderInput = z.infer<typeof ExtendRentalOrderSchema>;

// ==========================================
// 4. Return Units (Inspection & Damage Billing)
// ==========================================
export const UnitReturnSchema = z.object({
  unitId: z.string().uuid(),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'NEEDS_REPAIR']),
  damageSeverity: z.enum(['MINOR', 'MAJOR', 'UNUSABLE']).optional(),
  damageNotes: z.string().optional(),
  afterPhotos: z.array(z.string()).default([]),
});

export const ProcessReturnSchema = z.object({
  orderId: z.string().uuid(),
  actualReturnDate: z.date(),
  units: z.array(UnitReturnSchema).nonempty(),
  // On-the-spot damage/cleaning payment
  damagePayment: z.object({
    amount: z.number().nonnegative(),
    paymentMethod: z.enum(['CASH', 'BANK', 'QRIS']).default('CASH'),
    paymentAccountId: z.string().uuid().optional(),
  }).optional(),
});

export type ProcessReturnInput = z.infer<typeof ProcessReturnSchema>;

// ==========================================
// 5. Cancel Order (Refund DP & Stock Release)
// ==========================================
export const CancelRentalOrderSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().min(5, 'Alasan pembatalan harus diisi'),
  refundPayment: z.object({
    amount: z.number().nonnegative(),
    paymentAccountId: z.string().uuid().optional(),
  }).optional(),
});

export type CancelRentalOrderInput = z.infer<typeof CancelRentalOrderSchema>;
