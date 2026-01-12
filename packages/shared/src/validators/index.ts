import { z } from 'zod';
import {
  PartnerTypeSchema,
  OrderTypeSchema,
  InvoiceTypeSchema,
  PaymentMethodSchema,
  AuditLogActionSchema,
  EntityTypeSchema,
} from '../generated/zod/index.js';

// ============================================
// Shared Schemas
// ============================================

export * from './auth.js';
export * from './company.js';
export * from './finance.js';
export * from './user.js';
export * from './rental.js';

export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const UuidSchema = z.string().uuid();

export const CompanyIdSchema = z.string().uuid();

// ============================================
// Company Schemas moved to ./company.ts

// ============================================
// Partner Schemas
// ============================================

// PartnerTypeSchema is exported from generated zod

export const CreatePartnerSchema = z.object({
  name: z
    .string()
    .min(2, 'Partner name must be at least 2 characters'),
  type: PartnerTypeSchema,
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const UpdatePartnerSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const CreateCustomerSchema = CreatePartnerSchema.extend({
  type: z.literal('CUSTOMER'),
});

export const CreateSupplierSchema = CreatePartnerSchema.extend({
  type: z.literal('SUPPLIER'),
});

// ============================================
// Product Schemas
// ============================================

export const CreateProductSchema = z.object({
  sku: z.string().min(3, 'SKU must be at least 3 characters'),
  name: z
    .string()
    .min(2, 'Product name must be at least 2 characters'),
  price: z.number().positive('Price must be positive'),
});

export const ProductResponseSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  price: z.number(),
  stockQty: z.number().int(),
  averageCost: z.number(),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(2).optional(),
  price: z.number().positive().optional(),
});

// ============================================
// Order Schemas
// ============================================

// OrderTypeSchema and OrderStatusSchema are exported from generated zod

export const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive('Quantity must be positive'),
  price: z.number().positive('Price must be positive'),
});

export const CreateOrderSchema = z.object({
  partnerId: z.string().uuid(),
  type: OrderTypeSchema,
  items: z
    .array(OrderItemSchema)
    .min(1, 'Order must have at least one item'),
  taxRate: z.number().min(0).max(100).optional(),
});

export const CreateSalesOrderSchema = CreateOrderSchema.extend({
  type: z.literal('SALES'),
  paymentTerms: PaymentTermsSchema.optional(), // Cash Upfront Sales: Allow UPFRONT payment terms
  // Down Payment (optional)
  dpPercent: z.number().min(0).max(100).optional(), // 0-100%
  dpAmount: z.number().min(0).optional(), // Manual amount
});

// Feature 036: Add paymentTerms
// Re-export all generated Prisma/Zod schemas for consumers
export * from '../generated/zod/index.js';
import { PaymentTermsSchema } from '../generated/zod/index.js';
export const CreatePurchaseOrderSchema = CreateOrderSchema.extend({
  type: z.literal('PURCHASE'),
  paymentTerms: PaymentTermsSchema.optional().default('NET30'),
  // Down Payment (optional)
  dpPercent: z.number().min(0).max(100).optional(), // 0-100%
  dpAmount: z.number().min(0).optional(), // Manual amount
});

// ============================================
// Inventory Schemas
// ============================================

export * from './inventory.js';

// MovementTypeSchema is exported from generated zod

export const InventoryCheckSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
});

// Note: GRN/Shipment status now uses DocumentStatusSchema from generated zod
// (DRAFT, POSTED, VOIDED) - see schema.prisma DocumentStatus enum

export const InventoryResponseSchema = z.object({
  productId: z.string().uuid(),
  quantityOnHand: z.number().int(),
});

export const GoodsReceiptSchema = z.object({
  orderId: z.string().uuid(),
  reference: z.string().optional(),
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().int().positive(),
      })
    )
    .optional(),
  businessDate: z.coerce.date().optional(),
});

export const StockAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int(),
  costPerUnit: z.number().nonnegative(),
  reference: z.string().optional(),
});

// ============================================
// Invoice Schemas
// ============================================

// InvoiceTypeSchema and InvoiceStatusSchema are exported from generated zod

export const CreateInvoiceSchema = z.object({
  orderId: z.string().uuid().optional(),
  partnerId: z.string().uuid(),
  type: InvoiceTypeSchema,
  dueDate: z.coerce.date(),
  amount: z.number().positive('Amount must be positive'),
  businessDate: z.coerce.date().optional(), // G5: Explicit business date
  paymentTermsString: z.string().optional(), // Payment terms (NET30, NET60, etc.)
});

export const CreateBillSchema = CreateInvoiceSchema.extend({
  type: z.literal('BILL'),
});

export const InvoicePostSchema = z.object({
  businessDate: z.coerce.date().optional(), // G5
});

export const BillPostSchema = z.object({
  businessDate: z.coerce.date().optional(), // G5
});

// Manual Bill Creation (without Purchase Order)
export const CreateManualBillSchema = z.object({
  partnerId: z.string().uuid('Invalid supplier ID'),
  subtotal: z.number().positive('Subtotal must be positive'),
  taxRate: z.number().min(0).max(100).default(0),
  dueDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  businessDate: z.coerce.date().optional(), // G5: Explicit business date
});

// Bill Creation from Purchase Order (only requires orderId)
export const CreateBillFromPOSchema = z.object({
  orderId: z.string().uuid(),
  fulfillmentId: z.string().uuid().optional(), // Feature 041: Link to specific GRN/Receipt
  supplierInvoiceNumber: z.string().optional(), // External reference from supplier
  dueDate: z.coerce.date().optional(),
  taxRate: z.number().optional(),
  businessDate: z.coerce.date().optional(),
  paymentTermsString: z.string().optional(),
});

// Invoice Creation from Sales Order (only requires orderId)
export const CreateInvoiceFromSOSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  dueDate: z.coerce.date().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  invoiceNumber: z.string().optional(),
  businessDate: z.coerce.date().optional(), // G5: Explicit business date
});

// ============================================
// Payment Schemas
// ============================================

// PaymentMethodSchema is exported from generated zod

export const CreatePaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive('Payment amount must be positive'),
  method: PaymentMethodSchema,
  reference: z.string().optional(),
  bankAccountId: z.string().uuid().optional(), // Link to BankAccount (Cash/Bank)
  businessDate: z.coerce.date().optional(), // G5: Explicit business date
  correlationId: z.string().uuid().optional(), // FR-010.1: Request tracing
});

// ============================================
// Audit & Saga Schemas (FR-010.1, FR-010.2)
// ============================================

// AuditLogActionSchema and EntityTypeSchema are exported from generated zod

export const CreateAuditLogSchema = z.object({
  actorId: z.string().uuid(),
  action: AuditLogActionSchema,
  entityType: EntityTypeSchema,
  entityId: z.string().uuid(),
  businessDate: z.coerce.date(),
  payloadSnapshot: z.record(z.unknown()).optional(),
  correlationId: z.string().uuid().optional(),
});

export const SagaStatusSchema = z.enum([
  'PENDING',
  'STARTED',
  'COMPLETED',
  'FAILED',
  'COMPENSATING',
  'COMPENSATED',
]);

export const SagaLogInputSchema = z.object({
  sagaType: z.string(),
  entityId: z.string().uuid(),
  step: z.string(),
  stepData: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  correlationId: z.string().uuid().optional(),
});

// ============================================
// RBAC Schemas
// ============================================

export const CreateRoleSchema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters'),
  permissions: z.array(z.string().uuid()),
});

export const AssignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

// ============================================
// Type Exports (inferred from schemas)
// ============================================

export type CreatePartnerInput = z.infer<typeof CreatePartnerSchema>;
export type UpdatePartnerInput = z.infer<typeof UpdatePartnerSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type CreatePurchaseOrderInput = z.infer<
  typeof CreatePurchaseOrderSchema
>;
export type CreateSalesOrderInput = z.infer<
  typeof CreateSalesOrderSchema
>;
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type CreateInvoiceFromSOInput = z.infer<
  typeof CreateInvoiceFromSOSchema
>;
export type CreateBillInput = z.infer<typeof CreateBillSchema>;
export type CreateManualBillInput = z.infer<
  typeof CreateManualBillSchema
>;
export type CreateBillFromPOInput = z.infer<
  typeof CreateBillFromPOSchema
>;
export type InvoicePostInput = z.infer<typeof InvoicePostSchema>;
export type BillPostInput = z.infer<typeof BillPostSchema>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type GoodsReceiptInput = z.infer<typeof GoodsReceiptSchema>;
export type StockAdjustmentInput = z.infer<
  typeof StockAdjustmentSchema
>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
export type CreateAuditLogInput = z.infer<
  typeof CreateAuditLogSchema
>;
export type AuditLogAction = z.infer<typeof AuditLogActionSchema>;
export type SagaLogInput = z.infer<typeof SagaLogInputSchema>;
export type SagaStatus = z.infer<typeof SagaStatusSchema>;
export * from './p2p.js';
export * from './cash-bank.js';
