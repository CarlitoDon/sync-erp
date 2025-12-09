// Database Package - Main Entry Point
export { prisma, default as PrismaClient } from './client';

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
  PartnerType,
  OrderType,
  OrderStatus,
  MovementType,
  InvoiceType,
  InvoiceStatus,
} from '@prisma/client';
