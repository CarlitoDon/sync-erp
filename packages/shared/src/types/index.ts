// Core Types
// ============================================

export * from './auth.js';
export * from './finance.js';
export * from './partner.js';
import { MovementType } from '../constants/inventory.js';

export interface Company {
  id: string;
  name: string;
  businessShape?: 'PENDING' | 'RETAIL' | 'MANUFACTURING' | 'SERVICE';
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface CompanyMember {
  id: string;
  userId: string;
  companyId: string;
  roleId?: string;
}

// Partner Types moved to partner.ts

// ============================================
// Product Types
// ============================================

export interface Product {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  price: number;
  averageCost: number;
  stockQty: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Order Types
// ============================================

export type OrderType = 'SALES' | 'PURCHASE';
export type OrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Order {
  id: string;
  companyId: string;
  partnerId: string;
  type: OrderType;
  status: OrderStatus;
  date: Date;
  totalAmount: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
}

// ============================================
// Inventory Types
// ============================================

// MovementType moved to constants/inventory.ts

export interface InventoryMovement {
  id: string;
  companyId: string;
  productId: string;
  type: MovementType;
  quantity: number;
  reference?: string;
  date: Date;
}

// ============================================
// RBAC Types
// ============================================

export interface Role {
  id: string;
  companyId: string;
  name: string;
}

export interface Permission {
  id: string;
  module: string;
  action: string;
  scope: string;
}

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
