// ============================================
// Core Types
// ============================================

export interface Company {
  id: string;
  name: string;
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

// ============================================
// Partner Types (Customer & Supplier)
// ============================================

export type PartnerType = 'CUSTOMER' | 'SUPPLIER';

export interface Partner {
  id: string;
  companyId: string;
  type: PartnerType;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

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
}

// ============================================
// Order Types
// ============================================

export type OrderType = 'SALES' | 'PURCHASE';
export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

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

export type MovementType = 'IN' | 'OUT';

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
// Finance Types
// ============================================

export type InvoiceType = 'INVOICE' | 'BILL';
export type InvoiceStatus = 'DRAFT' | 'POSTED' | 'PAID' | 'VOID';

export interface Invoice {
  id: string;
  companyId: string;
  orderId?: string;
  partnerId: string;
  type: InvoiceType;
  status: InvoiceStatus;
  dueDate: Date;
  amount: number;
  balance: number;
}

export interface Payment {
  id: string;
  companyId: string;
  invoiceId: string;
  amount: number;
  date: Date;
  method: string;
}

export interface JournalEntry {
  id: string;
  companyId: string;
  reference?: string;
  date: Date;
}

export interface JournalLine {
  id: string;
  journalId: string;
  accountId: string;
  debit: number;
  credit: number;
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

export interface CreateCompanyDto {
  name: string;
}

export interface CreatePartnerDto {
  name: string;
  type: PartnerType;
  email?: string;
  phone?: string;
  address?: string;
}

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

export interface CreateInvoiceDto {
  orderId?: string;
  partnerId: string;
  type: InvoiceType;
  dueDate: Date;
  amount: number;
}

export interface CreatePaymentDto {
  invoiceId: string;
  amount: number;
  method: string;
}
