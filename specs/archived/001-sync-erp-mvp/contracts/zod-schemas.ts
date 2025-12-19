import { z } from 'zod';

// --- Shared Types ---

export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export const CompanyIdSchema = z.string().uuid();

// --- Auth / Multi-Company ---

export const CreateCompanySchema = z.object({
  name: z.string().min(2),
});

export const CompanyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.date(),
});

// --- Sales Module ---

export const CreateCustomerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  type: z.literal('CUSTOMER'),
});

export const CreateSalesOrderSchema = z.object({
  partnerId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        price: z.number().positive(), // Override or unit price
      })
    )
    .min(1),
});

// --- Inventory Module ---

export const InventoryCheckSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
});

export const InventoryResponseSchema = z.object({
  productId: z.string().uuid(),
  quantityOnHand: z.number().int(),
});

// --- Master Data ---

export const CreateProductSchema = z.object({
  sku: z.string().min(3),
  name: z.string().min(2),
  price: z.number().positive(),
});

export const ProductResponseSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  price: z.number(),
  stockQty: z.number().int(),
  averageCost: z.number(), // Output only
});

// --- RBAC ---

export const CreateRoleSchema = z.object({
  name: z.string().min(2),
  permissions: z.array(z.string().uuid()), // Permission IDs
});

export const AssignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});
