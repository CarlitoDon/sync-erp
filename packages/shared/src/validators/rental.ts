import { z } from 'zod';
import {
  RentalItemSchema,
  RentalOrderSchema,
  RentalOrderItemSchema as GeneratedRentalOrderItemSchema,
  PartnerSchema,
  RentalItemUnitSchema,
  RentalOrderStatusSchema,
  RentalPaymentStatusSchema,
  OrderSourceSchema,
  UnitStatusSchema,
  UnitConditionSchema,
  DepositPolicyTypeSchema,
  ProductSchema,
  ProductCategorySchema,
  RentalOrderUnitAssignmentSchema,
  RentalOrderExtensionSchema as GeneratedRentalOrderExtensionSchema,
  RentalOrderExtensionItemSchema as GeneratedRentalOrderExtensionItemSchema,
  RentalReturnSchema as GeneratedRentalReturnSchema,
  ReturnStatusSchema,
} from '../generated/zod/index.js';

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

// Bulk add units
// REMOVED: BulkAddUnitSchema - Manual bulk unit creation no longer supported
// All units must be created via ConvertStockToUnitSchema

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
export type ConvertStockToUnitInput = z.infer<
  typeof ConvertStockToUnitSchema
>;
export type CreateRentalOrderInput = z.infer<
  typeof CreateRentalOrderSchema
>;
export type ConfirmRentalOrderInput = z.infer<
  typeof ConfirmRentalOrderSchema
>;
export type ManualConfirmRentalOrderInput = z.infer<
  typeof ManualConfirmRentalOrderSchema
>;
export type HistoricalRentalSettlementInput = z.infer<
  typeof HistoricalRentalSettlementSchema
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

// ==========================================
// Rental Admin Task Queue Schemas
// ==========================================

export const RentalAdminTaskTypeSchema = z.enum([
  'CONFIRM_AND_DP',
  'VERIFY_PAYMENT',
  'DELIVERY_DISPATCH',
  'PELUNASAN_PAYMENT',
  'PICKUP_RETURN',
  'SETTLE_RETURN',
]);
export type RentalAdminTaskType = z.infer<typeof RentalAdminTaskTypeSchema>;

export const RentalTaskUrgencySchema = z.enum([
  'OVERDUE',
  'TODAY',
  'UPCOMING',
]);
export type RentalTaskUrgency = z.infer<typeof RentalTaskUrgencySchema>;

export const RentalAdminSuggestedActionSchema = z.enum([
  'CONFIRM',
  'VERIFY_PAYMENT',
  'RELEASE',
  'RECORD_PELUNASAN',
  'PROCESS_RETURN',
  'SETTLE_RETURN',
  'EXTEND',
]);
export type RentalAdminSuggestedAction = z.infer<
  typeof RentalAdminSuggestedActionSchema
>;

export const RentalAdminTaskCategorySchema = z.enum([
  'ALL',
  'CONFIRMATION',
  'DELIVERY',
  'PELUNASAN',
  'PICKUP',
  'RETURN',
]);
export type RentalAdminTaskCategory = z.infer<
  typeof RentalAdminTaskCategorySchema
>;

export const RentalAdminTaskItemSchema = z.object({
  id: z.string(),
  orderId: z.string().uuid(),
  orderNumber: z.string(),
  partnerId: z.string().uuid(),
  customerName: z.string(),
  customerPhone: z.string().nullable().optional(),
  taskType: RentalAdminTaskTypeSchema,
  category: RentalAdminTaskCategorySchema,
  urgency: RentalTaskUrgencySchema,
  title: z.string(),
  description: z.string(),
  scheduledDate: z.string(),
  daysDiff: z.number(),
  orderStatus: ApiRentalOrderStatusSchema,
  paymentStatus: ApiRentalPaymentStatusSchema,
  totalAmount: z.number(),
  depositAmount: z.number(),
  remainingAmount: z.number(),
  deliveryAddress: z.string().nullable().optional(),
  itemsSummary: z.string(),
  suggestedAction: RentalAdminSuggestedActionSchema,
});
export type RentalAdminTaskItem = z.infer<typeof RentalAdminTaskItemSchema>;

export const RentalAdminTaskQueueSummarySchema = z.object({
  totalPendingTasks: z.number(),
  overdueCount: z.number(),
  todayCount: z.number(),
  upcomingCount: z.number(),
  byCategory: z.object({
    confirmationCount: z.number(),
    deliveryCount: z.number(),
    pelunasanCount: z.number(),
    pickupCount: z.number(),
    returnSettlementCount: z.number(),
  }),
});
export type RentalAdminTaskQueueSummary = z.infer<
  typeof RentalAdminTaskQueueSummarySchema
>;

export const RentalAdminTaskQueueResponseSchema = z.object({
  summary: RentalAdminTaskQueueSummarySchema,
  tasks: z.array(RentalAdminTaskItemSchema),
});
export type RentalAdminTaskQueueResponse = z.infer<
  typeof RentalAdminTaskQueueResponseSchema
>;

export const GetRentalAdminTasksInputSchema = z.object({
  referenceDate: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.coerce.date().optional()
  ),
  category: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    RentalAdminTaskCategorySchema.optional()
  ),
  urgency: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.enum(['ALL', 'OVERDUE', 'TODAY', 'UPCOMING']).optional()
  ),
});
export type GetRentalAdminTasksInput = z.infer<
  typeof GetRentalAdminTasksInputSchema
>;

