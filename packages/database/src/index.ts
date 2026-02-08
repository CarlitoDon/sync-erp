// Database Package - Main Entry Point
export {
  prisma,
  withCompanyContext,
  setCompanyContext,
} from './client.js';

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
  // Feature 043: Rental Business
  RentalItem,
  RentalItemUnit,
  RentalOrder,
  RentalOrderItem,
  RentalOrderUnitAssignment,
  RentalDeposit,
  RentalDepositAllocation,
  RentalReturn,
  ItemConditionLog,
  CleaningLog,
  CustomerRentalRisk,
  RentalPolicy,
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
  PaymentMethodType,
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
  // Feature 043: Rental Business
  DepositPolicyType,
  UnitCondition,
  UnitStatus,
  RentalOrderStatus,
  RentalPaymentStatus,
  OrderSource,
  DepositStatus,
  ReturnStatus,
  ConditionType,
  DamageSeverity,
  CleaningType,
  RiskLevel,
} from './generated/client/client.js';

export type {
  Fulfillment,
  FulfillmentItem,
} from './generated/client/client.js';

export { Prisma } from './generated/client/client.js';
