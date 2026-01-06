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
  BankAccount,
  CashTransaction,
  CashTransactionItem,
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
  // GRN/Shipment Document Status
  DocumentStatus,
  // Feature 038: Fulfillment
  FulfillmentType,
  // FR-026: Permission Enums
  PermissionModule,
  PermissionAction,
  PermissionScope,
  // Feature 042: Cash and Bank
  CashTransactionType,
  CashTransactionStatus,
} from './generated/client/client.js';

export type {
  Fulfillment,
  FulfillmentItem,
} from './generated/client/client.js';

export { Prisma } from './generated/client/client.js';
