import { vi, beforeEach } from 'vitest';
import { mockPrisma, resetMocks } from './unit/mocks/prisma.mock';
import {
  mockInvoicePostingSaga,
  mockBillPostingSaga,
  mockPaymentPostingSaga,
  mockShipmentSaga,
  mockGoodsReceiptSaga,
  resetSagaMocks,
  setupDefaultSagaMocks,
} from './mocks/sagas.mock';

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
// Saga enums
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
  BusinessShape,
  CostingMethod,
  SagaType,
  SagaStep,
  IdempotencyScope,
  Prisma: {},
}));

// Mock all saga classes globally with function syntax for Vitest 4.x
vi.mock('@modules/accounting/sagas/invoice-posting.saga', () => ({
  InvoicePostingSaga: function () {
    return mockInvoicePostingSaga;
  },
}));
vi.mock(
  '@modules/accounting/sagas/bill-posting.saga',
  () => ({
    BillPostingSaga: function () {
      return mockBillPostingSaga;
    },
  })
);
vi.mock(
  '@modules/accounting/sagas/payment-posting.saga',
  () => ({
    PaymentPostingSaga: function () {
      return mockPaymentPostingSaga;
    },
  })
);
vi.mock('@modules/sales/sagas/shipment.saga', () => ({
  ShipmentSaga: function () {
    return mockShipmentSaga;
  },
}));
vi.mock(
  '@modules/procurement/sagas/goods-receipt.saga',
  () => ({
    GoodsReceiptSaga: function () {
      return mockGoodsReceiptSaga;
    },
  })
);

// Re-export for test files
export { mockPrisma, resetMocks };
export {
  mockInvoicePostingSaga,
  mockBillPostingSaga,
  mockPaymentPostingSaga,
  mockShipmentSaga,
  mockGoodsReceiptSaga,
};

beforeEach(() => {
  resetMocks();
  resetSagaMocks();
  setupDefaultSagaMocks();
});
