// ============================================
// Application Constants
// ============================================

export const APP_NAME = 'Sync ERP';
export const APP_VERSION = '0.0.1';

// ============================================
// HTTP Headers
// ============================================

export const HEADERS = {
  COMPANY_ID: 'x-company-id',
  USER_ID: 'x-user-id',
  AUTHORIZATION: 'authorization',
} as const;

// ============================================
// Pagination Defaults
// ============================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// ============================================
// Error Codes
// ============================================

export const ERROR_CODES = {
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // Business Logic
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  INVOICE_ALREADY_PAID: 'INVOICE_ALREADY_PAID',

  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

// ============================================
// Status Transitions
// ============================================

export const ORDER_STATUS_TRANSITIONS = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
} as const;

export const INVOICE_STATUS_TRANSITIONS = {
  DRAFT: ['POSTED', 'VOID'],
  POSTED: ['PAID', 'VOID'],
  PAID: [],
  VOID: [],
} as const;

// ============================================
// Modules (for RBAC)
// ============================================

export const MODULES = {
  COMPANY: 'COMPANY',
  SALES: 'SALES',
  PURCHASING: 'PURCHASING',
  INVENTORY: 'INVENTORY',
  FINANCE: 'FINANCE',
  USERS: 'USERS',
} as const;

export const ACTIONS = {
  CREATE: 'CREATE',
  READ: 'READ',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  APPROVE: 'APPROVE',
} as const;

export const SCOPES = {
  OWN: 'OWN',
  ALL: 'ALL',
} as const;

export const PAYMENT_TERMS = [
  { code: 'NET7', label: 'Net 7', days: 7 },
  { code: 'NET30', label: 'Net 30', days: 30 },
  { code: 'NET60', label: 'Net 60', days: 60 },
  { code: 'NET90', label: 'Net 90', days: 90 },
  { code: 'COD', label: 'Cash on Delivery', days: 0 },
  { code: 'EOM', label: 'End of Month', days: -1 }, // Special calculation
] as const;

export * from './inventory.js';
export * from './server.js';
