import { z } from 'zod';
import {
  RentalItemSchema,
  RentalItemUnitSchema,
  ProductSchema,
  ProductCategorySchema,
} from '../../generated/zod/index.js';

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

export type CreateRentalItemInput = z.infer<
  typeof CreateRentalItemSchema
>;

export const UpdateRentalItemSchema =
  BaseRentalItemSchema.partial().extend({
    isActive: z.boolean().optional(),
  });

export type UpdateRentalItemInput = z.infer<
  typeof UpdateRentalItemSchema
>;

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

export type UpdateUnitStatusInput = z.infer<
  typeof UpdateUnitStatusSchema
>;

const RentalUnitMetadataSchema = z.object({
  unitCode: z.string().trim().min(1).max(64).optional(),
  acquiredAt: z.coerce.date().optional(),
  acquisitionCost: z.number().positive().optional(),
  sizeLabel: z.string().trim().min(1).max(50).optional(),
  color: z.string().trim().min(1).max(50).optional(),
  sourceNotes: z.string().trim().min(1).max(1000).optional(),
});

// Convert Stock to Unit. Source fields are optional so existing flows keep working.
export const ConvertStockToUnitSchema = z
  .object({
    rentalItemId: z.string().uuid(),
    quantity: z.number().int().min(1, 'Minimal 1 unit'),
    sourceOrderId: z.string().uuid().optional(),
    sourceOrderItemId: z.string().uuid().optional(),
    sourceFulfillmentId: z.string().uuid().optional(),
    sourceBillId: z.string().uuid().optional(),
    sourceBatchCode: z.string().trim().min(1).max(100).optional(),
    unitCodes: z.array(z.string().trim().min(1).max(64)).optional(),
    unitMetadata: z.array(RentalUnitMetadataSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.unitCodes && data.unitCodes.length !== data.quantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['unitCodes'],
        message: 'unitCodes length must match quantity',
      });
    }
    if (data.unitMetadata && data.unitMetadata.length !== data.quantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['unitMetadata'],
        message: 'unitMetadata length must match quantity',
      });
    }
  });

export type ConvertStockToUnitInput = z.infer<
  typeof ConvertStockToUnitSchema
>;

// API Response Types for Items
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
