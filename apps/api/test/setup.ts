import { vi, beforeEach } from 'vitest';
import { mockPrisma, resetMocks } from './unit/mocks/prisma.mock';

// Mock enums
export enum PartnerType {
  CUSTOMER = 'CUSTOMER',
  SUPPLIER = 'SUPPLIER',
}
export enum OrderType {
  SALES = 'SALES',
  PURCHASE = 'PURCHASE',
}
export enum OrderStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
export enum MovementType {
  IN = 'IN',
  OUT = 'OUT',
}
export enum InvoiceType {
  INVOICE = 'INVOICE',
  BILL = 'BILL',
}
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  PAID = 'PAID',
  VOID = 'VOID',
}
export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
}

// Mock the @sync-erp/database module
vi.mock('@sync-erp/database', () => ({
  prisma: mockPrisma,
  PartnerType,
  OrderType,
  OrderStatus,
  MovementType,
  InvoiceType,
  InvoiceStatus,
  AccountType,
  Prisma: {},
}));

// Re-export for test files
export { mockPrisma, resetMocks };

beforeEach(() => {
  resetMocks();
});
