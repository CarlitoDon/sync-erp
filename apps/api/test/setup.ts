import { vi, beforeEach } from 'vitest';

// Mock enums - always needed
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
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  RECEIVED = 'RECEIVED',
  PARTIALLY_SHIPPED = 'PARTIALLY_SHIPPED',
  SHIPPED = 'SHIPPED',
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
export enum BusinessShape {
  PENDING = 'PENDING',
  RETAIL = 'RETAIL',
  MANUFACTURING = 'MANUFACTURING',
  SERVICE = 'SERVICE',
}
export enum CostingMethod {
  AVG = 'AVG',
  FIFO = 'FIFO',
}
export enum SagaType {
  INVOICE_POST = 'INVOICE_POST',
  SHIPMENT = 'SHIPMENT',
  GOODS_RECEIPT = 'GOODS_RECEIPT',
  BILL_POST = 'BILL_POST',
  PAYMENT_POST = 'PAYMENT_POST',
  CREDIT_NOTE = 'CREDIT_NOTE',
  STOCK_TRANSFER = 'STOCK_TRANSFER',
  STOCK_RETURN = 'STOCK_RETURN',
}
export enum SagaStep {
  PENDING = 'PENDING',
  STOCK_DONE = 'STOCK_DONE',
  BALANCE_DONE = 'BALANCE_DONE',
  JOURNAL_DONE = 'JOURNAL_DONE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  COMPENSATION_FAILED = 'COMPENSATION_FAILED',
}
export enum IdempotencyScope {
  PAYMENT_CREATE = 'PAYMENT_CREATE',
  INVOICE_POST = 'INVOICE_POST',
}
export enum PaymentTerms {
  NET7 = 'NET7',
  NET30 = 'NET30',
  NET60 = 'NET60',
  NET90 = 'NET90',
  COD = 'COD',
  EOM = 'EOM',
  NET_30 = 'NET_30',
  UPFRONT = 'UPFRONT',
}

// Only import and setup mocks for unit tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockPrisma: any;
let resetMocks: () => void = () => {};

// Import mocks dynamically for unit tests
const setupMocks = async () => {
  try {
    const prismaMock = await import('./unit/mocks/prisma.mock');
    mockPrisma = prismaMock.mockPrisma;
    resetMocks = prismaMock.resetMocks;
  } catch {
    // Integration tests don't need mocks
  }
};

// Mock @sync-erp/database only for unit tests
vi.mock('@sync-erp/database', async (importOriginal) => {
  // Check current test file path
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = (globalThis as any).__vitest_worker__;
  const filepath = state?.filepath || '';

  // Unit tests get mocked prisma
  if (filepath.includes('/test/unit/')) {
    const { mockPrisma: mp } =
      await import('./unit/mocks/prisma.mock');
    return {
      prisma: mp,
      PartnerType,
      OrderType,
      OrderStatus,
      MovementType,
      InvoiceType,
      InvoiceStatus,
      AccountType,
      BusinessShape,
      CostingMethod,
      SagaType,
      SagaStep,
      IdempotencyScope,
      PaymentTerms,
      Prisma: {},
    };
  }

  // Integration/e2e tests get real database
  const original = await importOriginal();
  return original;
});

// Re-export for test files
export { mockPrisma, resetMocks };

beforeEach(async () => {
  await setupMocks();
  if (resetMocks) resetMocks();
});
