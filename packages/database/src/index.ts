// Database Package - Main Entry Point
export { prisma } from './client.js';

// Re-export Prisma types for consumers
export type {
  Company,
  User,
  CompanyMember,
  Partner,
  Product,
  Order,
  OrderItem,
  InventoryMovement,
  Invoice,
  Payment,
  JournalEntry,
  JournalLine,
  Role,
  Permission,
  RolePermission,
  Session,
  Account,
  SagaLog,
  AuditLog,
} from './generated/client/client.js';

// Re-export enums as values (not just types)
export {
  PartnerType,
  OrderType,
  OrderStatus,
  MovementType,
  InvoiceType,
  InvoiceStatus,
  AccountType,
  BusinessShape,
  CostingMethod,
  IdempotencyScope,
  IdempotencyStatus,
  SagaType,
  SagaStep,
  JournalSourceType,
  AuditLogAction,
  EntityType,
  PaymentMethod,
  SequenceType,
  // Feature 036: Cash Upfront Payment
  PaymentTerms,
  PaymentStatus,
} from './generated/client/client.js';

export { Prisma } from './generated/client/client.js';
