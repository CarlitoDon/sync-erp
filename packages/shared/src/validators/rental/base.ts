import { z } from 'zod';
import {
  RentalItemSchema,
  RentalOrderSchema,
  RentalPaymentStatusSchema,
  RentalOrderStatusSchema,
  OrderSourceSchema,
  UnitStatusSchema,
  UnitConditionSchema,
  DepositPolicyTypeSchema,
  ReturnStatusSchema,
} from '../../generated/zod/index.js';

// Re-export generated schemas for use in other packages
export {
  RentalItemSchema,
  RentalOrderSchema,
  RentalPaymentStatusSchema,
};

// Export runtime Enums and Types
// Portable Schemas for API (avoiding ZodNativeEnum portability issues)
export const ApiRentalOrderStatusSchema = z.enum([
  'DRAFT',
  'CONFIRMED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
]);

export const ApiRentalPaymentStatusSchema = z.enum([
  'PENDING',
  'AWAITING_CONFIRM',
  'CONFIRMED',
  'FAILED',
]);

export const ApiUnitStatusSchema = z.enum([
  'AVAILABLE',
  'RESERVED',
  'RENTED',
  'RETURNED',
  'CLEANING',
  'MAINTENANCE',
  'RETIRED',
]);

export const ApiUnitConditionSchema = z.enum([
  'NEW',
  'GOOD',
  'FAIR',
  'NEEDS_REPAIR',
]);

export const RentalOrderStatus = RentalOrderStatusSchema.enum;
export type RentalOrderStatus = z.infer<
  typeof RentalOrderStatusSchema
>;

export const RentalPaymentStatus = RentalPaymentStatusSchema.enum;
export type RentalPaymentStatus = z.infer<
  typeof RentalPaymentStatusSchema
>;

export const OrderSource = OrderSourceSchema.enum;
export type OrderSource = z.infer<typeof OrderSourceSchema>;

export const UnitStatus = UnitStatusSchema.enum;
export type UnitStatus = z.infer<typeof UnitStatusSchema>;

export const UnitCondition = UnitConditionSchema.enum;
export type UnitCondition = z.infer<typeof UnitConditionSchema>;

export const DepositPolicyType = DepositPolicyTypeSchema.enum;
export type DepositPolicyType = z.infer<
  typeof DepositPolicyTypeSchema
>;

export const ReturnStatus = ReturnStatusSchema.enum;
export type ReturnStatus = z.infer<typeof ReturnStatusSchema>;

export const RentalPaymentMethodSchema = z.enum([
  'CASH',
  'BANK',
  'QRIS',
]);
export type RentalPaymentMethod = z.infer<
  typeof RentalPaymentMethodSchema
>;

// Policy Management
export const UpdateRentalPolicySchema = z.object({
  gracePeriodHours: z.number().int().min(0).max(72).optional(),
  lateFeeDailyRate: z.number().nonnegative().optional(),
  cleaningFee: z.number().nonnegative().optional(),
  defaultDepositPolicyType: z
    .enum(['PERCENTAGE', 'PER_UNIT', 'HYBRID'])
    .optional(),
  defaultDepositPercentage: z.number().min(1).max(100).optional(),
  defaultDepositPerUnit: z.number().positive().optional(),
  pickupGracePeriodHours: z.number().int().min(0).max(72).optional(),
  upstairsFeePerUnit: z.number().nonnegative().optional(),
  fittedSheetFeePerUnit: z.number().nonnegative().optional(),
});
export type UpdateRentalPolicyInput = z.infer<
  typeof UpdateRentalPolicySchema
>;

// Customer Risk Management
export const UpdateCustomerRiskSchema = z.object({
  partnerId: z.string().uuid(),
  riskLevel: z.enum(['NORMAL', 'WATCHLIST', 'BLACKLISTED']),
  notes: z.string().min(5, 'Notes required for risk changes'),
});
export type UpdateCustomerRiskInput = z.infer<
  typeof UpdateCustomerRiskSchema
>;
