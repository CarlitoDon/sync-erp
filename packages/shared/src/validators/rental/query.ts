import { z } from 'zod';
import {
  ApiRentalOrderStatusSchema,
  ApiRentalPaymentStatusSchema,
} from './base.js';

// ==========================================
// Report Queries
// ==========================================

export const RentalReportQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  itemId: z.string().uuid().optional(),
  category: z.string().optional(),
});
export type RentalReportQueryInput = z.infer<
  typeof RentalReportQuerySchema
>;

// ==========================================
// API Response Types
// ==========================================

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
