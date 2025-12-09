// Database Package - Main Entry Point
export { prisma, default as PrismaClient } from './client.js';

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
} from '@prisma/client';

// Re-export enums as values (not just types)
export {
  PartnerType,
  OrderType,
  OrderStatus,
  MovementType,
  InvoiceType,
  InvoiceStatus,
} from '@prisma/client';
