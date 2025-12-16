// Shared Saga Mocks for all tests
// This file provides mocks for all saga classes to prevent SagaType import issues
import { vi } from 'vitest';

// Generic success result for saga execution
export const createMockSagaResult = (data: unknown) => ({
  success: true,
  data,
  sagaLogId: 'saga-mock-1',
  error: null,
});

// Generic failure result for saga execution
export const createMockSagaFailure = (error: Error) => ({
  success: false,
  data: null,
  sagaLogId: 'saga-mock-1',
  error,
});

// Invoice Posting Saga Mock
export const mockInvoicePostingSaga = {
  execute: vi.fn(),
};

// Bill Posting Saga Mock
export const mockBillPostingSaga = {
  execute: vi.fn(),
};

// Payment Posting Saga Mock
export const mockPaymentPostingSaga = {
  execute: vi.fn(),
};

// Shipment Saga Mock
export const mockShipmentSaga = {
  execute: vi.fn(),
};

// Goods Receipt Saga Mock
export const mockGoodsReceiptSaga = {
  execute: vi.fn(),
};

// Credit Note Saga Mock
export const mockCreditNoteSaga = {
  execute: vi.fn(),
};

// Stock Transfer Saga Mock
export const mockStockTransferSaga = {
  execute: vi.fn(),
};

// Stock Return Saga Mock
export const mockStockReturnSaga = {
  execute: vi.fn(),
};

// Reset all saga mocks
export const resetSagaMocks = () => {
  mockInvoicePostingSaga.execute.mockReset();
  mockBillPostingSaga.execute.mockReset();
  mockPaymentPostingSaga.execute.mockReset();
  mockShipmentSaga.execute.mockReset();
  mockGoodsReceiptSaga.execute.mockReset();
  mockCreditNoteSaga.execute.mockReset();
  mockStockTransferSaga.execute.mockReset();
  mockStockReturnSaga.execute.mockReset();
};

// Setup default success responses for all sagas
export const setupDefaultSagaMocks = () => {
  mockInvoicePostingSaga.execute.mockResolvedValue(
    createMockSagaResult({ id: 'inv-1', status: 'POSTED' })
  );
  mockBillPostingSaga.execute.mockResolvedValue(
    createMockSagaResult({ id: 'bill-1', status: 'POSTED' })
  );
  mockPaymentPostingSaga.execute.mockResolvedValue(
    createMockSagaResult({ id: 'pay-1', amount: 100 })
  );
  mockShipmentSaga.execute.mockResolvedValue(
    createMockSagaResult({ movements: [] })
  );
  mockGoodsReceiptSaga.execute.mockResolvedValue(
    createMockSagaResult({ movements: [] })
  );
  mockCreditNoteSaga.execute.mockResolvedValue(
    createMockSagaResult({ id: 'cn-1', balance: 0 })
  );
  mockStockTransferSaga.execute.mockResolvedValue(
    createMockSagaResult({
      outboundMovement: {},
      inboundMovement: {},
    })
  );
  mockStockReturnSaga.execute.mockResolvedValue(
    createMockSagaResult({ movement: {} })
  );
};
