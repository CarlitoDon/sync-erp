// Core Types
// ============================================

import {
  OrderTypeType as OrderType,
  OrderStatusType as OrderStatus,
  User,
  OrderItem,
  Role,
  Permission,
} from '../generated/zod/index.js';

export type {
  OrderType,
  OrderStatus,
  User,
  OrderItem,
  Role,
  Permission,
};

export * from './auth.js';
export * from './finance.js';
export * from './partner.js';
// User type is now exported from generated/zod (via validators)
// export interface User {
//   id: string;
//   email: string;
//   name: string;
// }

// OrderType and OrderStatus are now exported from generated/zod
// export type OrderType = 'SALES' | 'PURCHASE';
// export type OrderStatus =
//   | 'DRAFT'
//   | 'CONFIRMED'
//   | 'COMPLETED'
//   | 'CANCELLED';

// OrderItem is now exported from generated/zod
// export interface OrderItem {
//   id: string;
//   orderId: string;
//   productId: string;
//   quantity: number;
//   price: number;
// }

// ============================================
// RBAC Types
// ============================================

// Role and Permission are now exported from generated/zod
// export interface Role {
//   id: string;
//   companyId: string;
//   name: string;
// }

// export interface Permission {
//   id: string;
//   module: string;
//   action: string;
//   scope: string;
// }

// ============================================
// API Types
// ============================================

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ============================================
// Create/Update DTOs
// ============================================

// Create properties removed effectively by using the export below
export * from './company.js';

// CreatePartnerDto moved to partner.ts

export interface CreateProductDto {
  sku: string;
  name: string;
  price: number;
}

export interface CreateOrderDto {
  partnerId: string;
  type: OrderType;
  items: CreateOrderItemDto[];
}

export interface CreateOrderItemDto {
  productId: string;
  quantity: number;
  price: number;
}
export * from './p2p';
export * from './report.js';
export * from './dashboard.js';
export * from './admin.js';
export * from './branded-ids.js';
