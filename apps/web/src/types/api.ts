/**
 * Centralized API Types - Inferred from tRPC Router
 *
 * This file provides type-safe access to all API types without
 * needing to import from @sync-erp/shared for entity types.
 *
 * Usage:
 *   import { Invoice, Company, Product } from '@/types/api';
 *   import type { CreateProductInput } from '@/types/api';
 */

import type {
  inferRouterInputs,
  inferRouterOutputs,
} from '@trpc/server';
import type { AppRouter } from '../../../api/src/trpc/router';

// ===========================================
// Core Type Inference
// ===========================================

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

// ===========================================
// Entity Types (from API responses)
// ===========================================

// Company & Auth
export type Company = NonNullable<
  RouterOutputs['company']['getById']
>;
export type CompanyList = RouterOutputs['company']['list'];
export type User = NonNullable<RouterOutputs['auth']['me']>;

// Partners
export type Partner = NonNullable<
  RouterOutputs['partner']['getById']
>;
export type PartnerList = RouterOutputs['partner']['list'];

// Products
export type Product = NonNullable<
  RouterOutputs['product']['getById']
>;
export type ProductList = RouterOutputs['product']['list'];

// Orders
export type SalesOrder = NonNullable<
  RouterOutputs['salesOrder']['getById']
>;
export type SalesOrderList = RouterOutputs['salesOrder']['list'];
export type PurchaseOrder = NonNullable<
  RouterOutputs['purchaseOrder']['getById']
>;
export type PurchaseOrderList =
  RouterOutputs['purchaseOrder']['list'];

// Accounting
export type Invoice = NonNullable<
  RouterOutputs['invoice']['getById']
>;
export type InvoiceList = RouterOutputs['invoice']['list'];
export type Bill = NonNullable<RouterOutputs['bill']['getById']>;
export type BillList = RouterOutputs['bill']['list'];
export type Payment = RouterOutputs['payment']['list'][number];

// Inventory
export type GoodsReceipt = NonNullable<
  RouterOutputs['inventory']['getGRN']
>;
export type Shipment = NonNullable<
  RouterOutputs['inventory']['getShipment']
>;

// Dashboard
export type DashboardMetrics =
  RouterOutputs['dashboard']['getMetrics'];

// ===========================================
// Input Types (for mutations)
// ===========================================

// Company
export type CreateCompanyInput = RouterInputs['company']['create'];
export type JoinCompanyInput = RouterInputs['company']['join'];

// Partners
export type CreatePartnerInput = RouterInputs['partner']['create'];
export type UpdatePartnerInput = RouterInputs['partner']['update'];

// Products
export type CreateProductInput = RouterInputs['product']['create'];
export type UpdateProductInput = RouterInputs['product']['update'];

// Orders
export type CreateSalesOrderInput =
  RouterInputs['salesOrder']['create'];
export type CreatePurchaseOrderInput =
  RouterInputs['purchaseOrder']['create'];

// Accounting
export type CreateInvoiceFromSOInput =
  RouterInputs['invoice']['createFromSO'];
export type CreateBillFromPOInput =
  RouterInputs['bill']['createFromPO'];
export type CreatePaymentInput = RouterInputs['payment']['create'];

// Auth
export type LoginInput = RouterInputs['auth']['login'];
export type RegisterInput = RouterInputs['auth']['register'];

// ===========================================
// Re-export constants & enums from shared
// (These are NOT available via tRPC inference)
// ===========================================

// Constants for dropdowns
export { PAYMENT_TERMS, BusinessShape } from '@sync-erp/shared';

import { PaymentMethodTypeSchema } from '@sync-erp/shared';
export { PaymentMethodTypeSchema };

// Derived constants
export const PAYMENT_METHODS = PaymentMethodTypeSchema.options;

// Zod schemas for validation/type guards
export {
  InvoiceStatusSchema,
  OrderStatusSchema,
  AccountType,
} from '@sync-erp/shared';

// Types that are used for display/grouping
export type {
  AccountGroup,
  BalanceSheetReport,
} from '@sync-erp/shared';

// Utility functions
export { calculateDueDate } from '@sync-erp/shared';
