import { z } from 'zod';

// ============================================
// Shared Schemas
// ============================================

export * from './auth.js';

export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const UuidSchema = z.string().uuid();

export const CompanyIdSchema = z.string().uuid();

// ============================================
// Company Schemas
// ============================================

export const CreateCompanySchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
});

export const CompanyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.coerce.date(),
});

// ============================================
// Partner Schemas
// ============================================

export const PartnerTypeSchema = z.enum(['CUSTOMER', 'SUPPLIER']);

export const CreatePartnerSchema = z.object({
  name: z.string().min(2, 'Partner name must be at least 2 characters'),
  type: PartnerTypeSchema,
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
  name: z.string().min(2, 'Product name must be at least 2 characters'),
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

// ============================================
// Order Schemas
// ============================================

export const OrderTypeSchema = z.enum(['SALES', 'PURCHASE']);
export const OrderStatusSchema = z.enum(['DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED']);

export const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive('Quantity must be positive'),
  price: z.number().positive('Price must be positive'),
});

export const CreateOrderSchema = z.object({
  partnerId: z.string().uuid(),
  type: OrderTypeSchema,
  items: z.array(OrderItemSchema).min(1, 'Order must have at least one item'),
});

export const CreateSalesOrderSchema = CreateOrderSchema.extend({
  type: z.literal('SALES'),
});

export const CreatePurchaseOrderSchema = CreateOrderSchema.extend({
  type: z.literal('PURCHASE'),
});

// ============================================
// Inventory Schemas
// ============================================

export const MovementTypeSchema = z.enum(['IN', 'OUT']);

export const InventoryCheckSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
});

export const InventoryResponseSchema = z.object({
  productId: z.string().uuid(),
  quantityOnHand: z.number().int(),
});

// ============================================
// Invoice Schemas
// ============================================

export const InvoiceTypeSchema = z.enum(['INVOICE', 'BILL']);
export const InvoiceStatusSchema = z.enum(['DRAFT', 'POSTED', 'PAID', 'VOID']);

export const CreateInvoiceSchema = z.object({
  orderId: z.string().uuid().optional(),
  partnerId: z.string().uuid(),
  type: InvoiceTypeSchema,
  dueDate: z.coerce.date(),
  amount: z.number().positive('Amount must be positive'),
});

// ============================================
// Payment Schemas
// ============================================

export const CreatePaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive('Payment amount must be positive'),
  method: z.string().min(1, 'Payment method is required'),
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

export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;
export type CreatePartnerInput = z.infer<typeof CreatePartnerSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
