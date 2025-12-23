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
