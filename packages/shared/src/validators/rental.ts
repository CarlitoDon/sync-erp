import { z } from 'zod';
import {
  RentalItemSchema,
  RentalOrderSchema,
  RentalOrderItemSchema as GeneratedRentalOrderItemSchema,
  PartnerSchema,
  RentalItemUnitSchema,
  RentalOrderStatusSchema,
  UnitStatusSchema,
  UnitConditionSchema,
  DepositPolicyTypeSchema,
  ProductSchema,
  ProductCategorySchema,
  RentalOrderUnitAssignmentSchema,
  RentalReturnSchema as GeneratedRentalReturnSchema,
} from '../generated/zod/index.js';

// Re-export generated schemas for use in other packages
export { RentalItemSchema, RentalOrderSchema };

// Export runtime Enums and Types
export const RentalOrderStatus = RentalOrderStatusSchema.enum;
export type RentalOrderStatus = z.infer<
  typeof RentalOrderStatusSchema
>;

export const UnitStatus = UnitStatusSchema.enum;
export type UnitStatus = z.infer<typeof UnitStatusSchema>;

export const UnitCondition = UnitConditionSchema.enum;
export type UnitCondition = z.infer<typeof UnitConditionSchema>;

export const DepositPolicyType = DepositPolicyTypeSchema.enum;
export type DepositPolicyType = z.infer<
  typeof DepositPolicyTypeSchema
>;

// ==========================================
// Rental Item Management
// ==========================================

// Extended Schema for Service Return Type (Portable)
export const RentalItemWithRelationsSchema = RentalItemSchema.extend({
  product: ProductSchema.extend({
    category: ProductCategorySchema.nullable().optional(),
  }).optional(),
  units: z.array(RentalItemUnitSchema),
});

export type RentalItemWithRelations = z.infer<
  typeof RentalItemWithRelationsSchema
>;

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
          })
          .nullable()
          .optional(),
      })
    ),
    partner: PartnerSchema,
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

// ==========================================
// Rental Item Management
// ==========================================

const BaseRentalItemSchema = z.object({
  productId: z.string().uuid(), // Link to existing Product
  dailyRate: z.number().positive(),
  weeklyRate: z.number().positive(),
  monthlyRate: z.number().positive(),
  depositPolicyType: z.enum(['PERCENTAGE', 'PER_UNIT', 'HYBRID']),
  depositPercentage: z.number().min(1).max(100).optional(),
  depositPerUnit: z.number().positive().optional(),
});

export const CreateRentalItemSchema = BaseRentalItemSchema.refine(
  (data) => {
    // weeklyRate should be less than 7 × dailyRate for economic incentive
    return data.weeklyRate < data.dailyRate * 7;
  },
  {
    message:
      'Weekly rate must be less than 7x daily rate for economic incentive',
    path: ['weeklyRate'],
  }
)
  .refine(
    (data) => {
      // monthlyRate should be less than 30 × dailyRate
      return data.monthlyRate < data.dailyRate * 30;
    },
    {
      message:
        'Monthly rate must be less than 30x daily rate for economic incentive',
      path: ['monthlyRate'],
    }
  )
  .refine(
    (data) => {
      // Validate deposit policy requirements
      if (data.depositPolicyType === 'PERCENTAGE') {
        return data.depositPercentage !== undefined;
      }
      if (data.depositPolicyType === 'PER_UNIT') {
        return data.depositPerUnit !== undefined;
      }
      if (data.depositPolicyType === 'HYBRID') {
        return (
          data.depositPercentage !== undefined &&
          data.depositPerUnit !== undefined
        );
      }
      return true;
    },
    {
      message:
        'Deposit policy requires appropriate percentage or per-unit amount',
      path: ['depositPolicyType'],
    }
  );

export const UpdateRentalItemSchema =
  BaseRentalItemSchema.partial().extend({
    isActive: z.boolean().optional(),
  });

// REMOVED: AddRentalUnitSchema - Manual unit creation no longer supported
// All units must be created via ConvertStockToUnitSchema

export const UpdateUnitStatusSchema = z.object({
  unitId: z.string().uuid(),
  status: z.enum([
    'AVAILABLE',
    'RESERVED',
    'RENTED',
    'RETURNED',
    'CLEANING',
    'MAINTENANCE',
    'RETIRED',
  ]),
  reason: z.string().min(5).optional(), // Required for MAINTENANCE and RETIRED
});

// ==========================================
// Rental Orders
// ==========================================

const RentalOrderItemSchema = z.object({
  rentalItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
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

export const ConfirmRentalOrderSchema = z.object({
  orderId: z.string().uuid(),
  depositAmount: z.number().nonnegative(),
  paymentMethod: z.string().min(1), // e.g., "Cash", "Transfer", "Card"
  paymentReference: z.string().optional(),
  unitAssignments: z
    .array(
      z.object({
        unitId: z.string().uuid(),
      })
    )
    .min(1, 'Minimal 1 unit harus dipilih untuk konfirmasi order'),
});

// Bulk add units
// REMOVED: BulkAddUnitSchema - Manual bulk unit creation no longer supported
// All units must be created via ConvertStockToUnitSchema

// Convert Stock to Unit
export const ConvertStockToUnitSchema = z.object({
  rentalItemId: z.string().uuid(),
  prefix: z
    .string()
    .min(2, 'Prefix minimal 2 karakter')
    .regex(
      /^[A-Z0-9]+$/,
      'Prefix hanya boleh huruf kapital dan angka'
    ),
  quantity: z.number().min(1, 'Minimal 1 unit'),
  startNumber: z.number().min(1).default(1),
});

const UnitReleaseSchema = z.object({
  unitId: z.string().uuid(),
  beforePhotos: z
    .array(z.string())
    .min(1, 'At least one photo required'),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'NEEDS_REPAIR']),
  notes: z.string().optional(),
});

export const ReleaseRentalOrderSchema = z.object({
  orderId: z.string().uuid(),
  unitAssignments: z.array(UnitReleaseSchema).min(1),
});

export const CancelRentalOrderSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().min(5, 'Cancellation reason required'),
});

export const ExtendRentalOrderSchema = z.object({
  orderId: z.string().uuid(),
  newEndDate: z
    .string()
    .datetime()
    .transform((str) => new Date(str)),
  notes: z.string().optional(),
});

// ==========================================
// Returns & Settlement
// ==========================================

const UnitReturnSchema = z.object({
  unitId: z.string().uuid(),
  afterPhotos: z.array(z.string()), // Required if damaged
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'NEEDS_REPAIR']),
  damageSeverity: z.enum(['MINOR', 'MAJOR', 'UNUSABLE']).optional(),
  damageNotes: z.string().optional(),
});

export const ProcessReturnSchema = z.object({
  orderId: z.string().uuid(),
  actualReturnDate: z.date(),
  units: z.array(UnitReturnSchema).nonempty(),
});

export const FinalizeReturnSchema = z.object({
  returnId: z.string().uuid(),
  // Optional adjustments before finalizing
  damageChargesOverride: z.number().nonnegative().optional(),
  cleaningFeesOverride: z.number().nonnegative().optional(),
  otherCharges: z.number().nonnegative().optional(),
  settlementNotes: z.string().optional(),
});

export const CreateInvoiceFromReturnSchema = z.object({
  returnId: z.string().uuid(),
  dueDate: z
    .string()
    .datetime()
    .transform((str) => new Date(str)),
  notes: z.string().optional(),
});

// ==========================================
// Policy Management
// ==========================================

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
});

// ==========================================
// Customer Risk Management
// ==========================================

export const UpdateCustomerRiskSchema = z.object({
  partnerId: z.string().uuid(),
  riskLevel: z.enum(['NORMAL', 'WATCHLIST', 'BLACKLISTED']),
  notes: z.string().min(5, 'Notes required for risk changes'),
});

// ==========================================
// Report Queries
// ==========================================

export const RentalReportQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  itemId: z.string().uuid().optional(),
  category: z.string().optional(),
});

// ==========================================
// Input Types (from Zod schemas)
// ==========================================

export type CreateRentalItemInput = z.infer<
  typeof CreateRentalItemSchema
>;
export type UpdateRentalItemInput = z.infer<
  typeof UpdateRentalItemSchema
>;
// REMOVED: AddRentalUnitInput - Manual unit creation no longer supported
export type UpdateUnitStatusInput = z.infer<
  typeof UpdateUnitStatusSchema
>;
export type CreateRentalOrderInput = z.infer<
  typeof CreateRentalOrderSchema
>;
export type ConfirmRentalOrderInput = z.infer<
  typeof ConfirmRentalOrderSchema
>;
export type ReleaseRentalOrderInput = z.infer<
  typeof ReleaseRentalOrderSchema
>;
export type CancelRentalOrderInput = z.infer<
  typeof CancelRentalOrderSchema
>;
export type ProcessReturnInput = z.infer<typeof ProcessReturnSchema>;
export type FinalizeReturnInput = z.infer<
  typeof FinalizeReturnSchema
>;
export type ExtendRentalOrderInput = z.infer<
  typeof ExtendRentalOrderSchema
>;
export type CreateInvoiceFromReturnInput = z.infer<
  typeof CreateInvoiceFromReturnSchema
>;
export type UpdateRentalPolicyInput = z.infer<
  typeof UpdateRentalPolicySchema
>;
export type UpdateCustomerRiskInput = z.infer<
  typeof UpdateCustomerRiskSchema
>;
export type RentalReportQueryInput = z.infer<
  typeof RentalReportQuerySchema
>;

// ==========================================
// API Response Types
// ==========================================

export interface RentalItemResponse {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  category: string;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  depositPolicyType: 'PERCENTAGE' | 'PER_UNIT' | 'HYBRID';
  depositPercentage?: number;
  depositPerUnit?: number;
  isActive: boolean;
  unitCount?: number;
  availableCount?: number;
  createdAt: string;
}

export interface RentalItemUnitResponse {
  id: string;
  rentalItemId: string;
  unitCode: string;
  condition: 'NEW' | 'GOOD' | 'FAIR' | 'NEEDS_REPAIR';
  status:
    | 'AVAILABLE'
    | 'RESERVED'
    | 'RENTED'
    | 'RETURNED'
    | 'CLEANING'
    | 'MAINTENANCE'
    | 'RETIRED';
  totalRentalDays: number;
  totalRentalCount: number;
  lastDeepCleaningAt?: string;
  rentalItem?: { name: string; category: string };
}

export interface RentalOrderResponse {
  id: string;
  companyId: string;
  partnerId: string;
  orderNumber: string;
  rentalStartDate: string;
  rentalEndDate: string;
  dueDateTime: string;
  status:
    | 'DRAFT'
    | 'CONFIRMED'
    | 'ACTIVE'
    | 'COMPLETED'
    | 'CANCELLED';
  subtotal: number;
  depositAmount: number;
  totalAmount: number;
  notes?: string;
  partner?: { name: string; phone?: string };
  items?: RentalOrderItemResponse[];
  createdAt: string;
}

export interface RentalOrderItemResponse {
  id: string;
  rentalItemId: string;
  quantity: number;
  unitPrice: number;
  pricingTier: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  subtotal: number;
  rentalItem?: { name: string; category: string };
}

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

export interface RentalUtilizationReport {
  itemId: string;
  itemName: string;
  category: string;
  totalDays: number;
  rentedDays: number;
  utilizationRate: number; // 0-100%
}

export interface RentalRevenueReport {
  category: string;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface OverdueRentalResponse {
  orderId: string;
  orderNumber: string;
  partnerId: string;
  partnerName: string;
  dueDateTime: string;
  daysLate: number;
  accruedLateFees: number;
}
