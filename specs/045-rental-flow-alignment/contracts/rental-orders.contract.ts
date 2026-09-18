/**
 * Rental Order Lifecycle API Contracts
 * Feature: 045-rental-flow-alignment
 *
 * Single Source of Truth for Zod schemas in @sync-erp/shared
 */

import { z } from 'zod';

// ==========================================
// 1. Confirm Order (DP & Serial Locking)
// ==========================================
export const UnitAssignmentInputSchema = z.object({
  unitId: z.string().uuid(),
});

export const ConfirmRentalOrderContractSchema = z.object({
  orderId: z.string().uuid(),
  depositAmount: z.number().nonnegative(), // DP ~30%
  paymentMethod: z.enum(['CASH', 'BANK', 'QRIS']).default('BANK'),
  paymentAccountId: z.string().uuid().optional(),
  unitAssignments: z.array(UnitAssignmentInputSchema).optional(),
});

export type ConfirmRentalOrderContract = z.infer<typeof ConfirmRentalOrderContractSchema>;

// ==========================================
// 2. Release Units (Serah Terima & Pelunasan 70%)
// ==========================================
export const UnitReleaseInputSchema = z.object({
  unitId: z.string().uuid(),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'NEEDS_REPAIR']),
  beforePhotos: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const ReleaseRentalOrderContractSchema = z.object({
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

export type ReleaseRentalOrderContract = z.infer<typeof ReleaseRentalOrderContractSchema>;

// ==========================================
// 3. Extension (Full & Partial with Fleet Fee)
// ==========================================
export const ExtendRentalOrderItemContractSchema = z.object({
  rentalOrderItemId: z.string().uuid().optional(),
  rentalItemId: z.string().uuid().optional(),
  quantity: z.number().int().positive().optional(),
  unitPrice: z.number().nonnegative().optional(),
  additionalAmount: z.number().nonnegative().optional(),
});

export const ExtendRentalOrderContractSchema = z.object({
  orderId: z.string().uuid(),
  newEndDate: z.string().datetime().transform((str) => new Date(str)),
  additionalAmount: z.number().nonnegative().optional(),
  deliveryFee: z.number().nonnegative().optional(), // Biaya Tambahan Armada
  deliveryFeeLabel: z.string().optional().default('Biaya Tambahan Armada'),
  items: z.array(ExtendRentalOrderItemContractSchema).min(1).optional(),
  payment: z.object({
    amount: z.number().nonnegative(),
    paymentMethod: z.enum(['CASH', 'BANK', 'QRIS']).default('BANK'),
    paymentAccountId: z.string().uuid().optional(),
  }).optional(),
});

export type ExtendRentalOrderContract = z.infer<typeof ExtendRentalOrderContractSchema>;

// ==========================================
// 4. Return Units (Inspection & Damage Billing)
// ==========================================
export const UnitReturnContractSchema = z.object({
  unitId: z.string().uuid(),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'NEEDS_REPAIR']),
  damageSeverity: z.enum(['MINOR', 'MAJOR', 'UNUSABLE']).optional(),
  damageNotes: z.string().optional(),
  afterPhotos: z.array(z.string()).default([]),
});

export const ProcessReturnContractSchema = z.object({
  orderId: z.string().uuid(),
  actualReturnDate: z.date(),
  units: z.array(UnitReturnContractSchema).nonempty(),
  // On-the-spot damage/cleaning payment
  damagePayment: z.object({
    amount: z.number().nonnegative(),
    paymentMethod: z.enum(['CASH', 'BANK', 'QRIS']).default('CASH'),
    paymentAccountId: z.string().uuid().optional(),
  }).optional(),
});

export type ProcessReturnContract = z.infer<typeof ProcessReturnContractSchema>;

// ==========================================
// 5. Cancel Order (Refund DP & Stock Release)
// ==========================================
export const CancelRentalOrderContractSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().min(5, 'Alasan pembatalan harus diisi'),
  refundPayment: z.object({
    amount: z.number().nonnegative(),
    paymentAccountId: z.string().uuid().optional(),
  }).optional(),
});

export type CancelRentalOrderContract = z.infer<typeof CancelRentalOrderContractSchema>;
