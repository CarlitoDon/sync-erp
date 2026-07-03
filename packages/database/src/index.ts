// Database Package - Main Entry Point
export {
  prisma,
  withCompanyContext,
  setCompanyContext,
} from './client.js';

export {
  requestContext,
  getRequestContext,
} from './als.js';
export type { RequestContext } from './als.js';

// Re-export Prisma types for consumers
export type {
  Company,
  User,
  CompanyMember,
  OAuthAccount,
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
  EmailVerificationToken,
  AuthAuditLog,
  Account,
  SagaLog,
  AuditLog,
  BankAccount,
  CashTransaction,
  CashTransactionItem,
  CompanySubscription,
  BillingCheckoutSession,
  BillingWebhookEvent,
  Attachment,
  BillInstallmentSchedule,
  // Feature 043: Rental Business
  RentalItem,
  RentalItemUnit,
  RentalOrder,
  RentalOrderItem,
  RentalOrderExtension,
  RentalOrderExtensionItem,
  RentalOrderUnitAssignment,
  RentalDeposit,
  RentalDepositAllocation,
  RentalReturn,
  ItemConditionLog,
  CleaningLog,
  CustomerRentalRisk,
  RentalPolicy,
  RentalWebhookOutbox,
  TenantWebhookOutbox,
} from './generated/client/client.js';

// Re-export enums as values (not just types)
export {
  PartnerType,
  OrderType,
  OrderStatus,
  OAuthProvider,
  MovementType,
  InvoiceType,
  InvoiceStatus,
  AccountType,
  BusinessShape,
  CostingMethod,
  CompanyOnboardingStatus,
  CompanyOnboardingStep,
  BillingSubscriptionStatus,
  BillingProvider,
  BillingCycle,
  BillingCheckoutSessionStatus,
  BillingWebhookEventStatus,
  AttachmentEntityType,
  BillInstallmentStatus,
  IdempotencyScope,
  IdempotencyStatus,
  SagaType,
  SagaStep,
  JournalSourceType,
  AuditLogAction,
  AuthAuditAction,
  EntityType,
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
  RentalWebhookDeliveryType,
  RentalWebhookOutboxStatus,
  TenantWebhookOutboxStatus,
} from './generated/client/client.js';

export type {
  Fulfillment,
  FulfillmentItem,
} from './generated/client/client.js';

export { Prisma } from './generated/client/client.js';
