import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SalesService } from '../../../../src/modules/sales/sales.service';
import { InvoiceService } from '../../../../src/modules/accounting/services/invoice.service';
import { PaymentService } from '../../../../src/modules/accounting/services/payment.service';
import {
  BusinessShape,
  InvoiceStatus,
  OrderStatus,
  InvoiceType,
} from '@sync-erp/database';

// Mock Repositories GLOBALLY
vi.mock('../../../../src/modules/sales/sales.repository');
vi.mock(
  '../../../../src/modules/accounting/repositories/invoice.repository'
);
vi.mock(
  '../../../../src/modules/accounting/repositories/payment.repository'
);
vi.mock(
  '../../../../src/modules/accounting/repositories/journal.repository'
);
vi.mock('../../../../src/modules/inventory/inventory.repository');
vi.mock('../../../../src/modules/product/product.repository');

// Mock Doc Service
vi.mock(
  '../../../../src/modules/common/services/document-number.service'
);

// Mock ProductService (to avoid complex stock logic, or let it use mocked repo?)
// SalesService uses ProductService. InventoryService uses ProductService.
// Verification: SalesService.confirm calls ProductService.checkStock.
// InventoryService.processShipment calls ProductService.checkStock AND updateAverageCost? No, adjustStock calls it.
// processShipment calls InventoryRepository.createMovement and ProductRepository.updateQuantity (via ProductService).
// To simplify, let's Mock ProductService methods too?
// But we want "Real Logic".
// Let's mock ProductRepository.findById to return product data.
// And mock ProductService.checkStock?
// `ProductService` imports `ProductRepository`. If we mock repo, Service logic runs.
// `checkStock` checks `repo.findById`.
// So we just mock `ProductRepository`.

// Mock Prisma GLOBALLY for InventoryService direct access
vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');
  return {
    ...actual,
    prisma: {
      order: {
        findFirst: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      account: {
        findFirst: vi.fn(),
      },
    },
  };
});

// Mock Sagas
const mockInvoicePostingSaga = { execute: vi.fn() };
vi.mock(
  '../../../../src/modules/accounting/sagas/invoice-posting.saga',
  () => ({
    InvoicePostingSaga: function () {
      return mockInvoicePostingSaga;
    },
  })
);

const mockPaymentPostingSaga = { execute: vi.fn() };
vi.mock(
  '../../../../src/modules/accounting/sagas/payment-posting.saga',
  () => ({
    PaymentPostingSaga: function () {
      return mockPaymentPostingSaga;
    },
  })
);

// Access Mocks needs to be dynamic or via vi.mocked imports in test?
import { SalesRepository } from '../../../../src/modules/sales/sales.repository';
import { InvoiceRepository } from '../../../../src/modules/accounting/repositories/invoice.repository';
import { PaymentRepository } from '../../../../src/modules/accounting/repositories/payment.repository';

import { InventoryRepository } from '../../../../src/modules/inventory/inventory.repository';
import { ProductRepository } from '../../../../src/modules/product/product.repository';
import { DocumentNumberService } from '../../../../src/modules/common/services/document-number.service';
import { prisma } from '@sync-erp/database';

describe('T010: Quote-to-Cash Integration (E2E Flow)', () => {
  // Services
  let salesService: SalesService;
  let invoiceService: InvoiceService;
  let paymentService: PaymentService;
  // We don't instantiate InventoryService directly always, but InvoiceService does.
  // But we might need to mock calls if we want to spy?
  // Using vi.spyOn regarding prototype?
  // Or just check Repositories calls.

  // Mocks
  // We use vi.mocked(Class.prototype) in tests. variables below unused.
  beforeEach(() => {
    vi.clearAllMocks();

    // Instantiate REAL services (They will use mocked Repositories internally)
    salesService = new SalesService();
    invoiceService = new InvoiceService();
    paymentService = new PaymentService();

    // Mocks are applied to module prototypes via top-level vi.mock
  });

  it('Scenario 1: Full Flow (Order -> Invoice -> Payment)', async () => {
    const companyId = 'co-test';
    const partnerId = 'cust-1';
    const productId = 'prod-1';

    // --- 1. Create Sales Order ---
    vi.mocked(
      DocumentNumberService.prototype.generate
    ).mockResolvedValue('SO-1001');
    vi.mocked(SalesRepository.prototype.create).mockImplementation(
      (d) =>
        Promise.resolve({
          ...d,
          id: 'so-1',
          totalAmount: 110,
          taxRate: 10,
        } as any)
    );

    // Product exists
    vi.mocked(ProductRepository.prototype.findById).mockResolvedValue(
      {
        id: productId,
        price: 100,
        cost: 50,
        stockQuantity: 100,
      } as any
    );

    const order = await salesService.create(
      companyId,
      {
        partnerId,
        items: [{ productId, quantity: 1, price: 100 }],
      },
      BusinessShape.RETAIL
    );

    expect(order.orderNumber).toBe('SO-1001');

    // --- 2. Confirm Sales Order ---
    // Mock finding order for confirm. Include product for error logging safety.
    vi.mocked(SalesRepository.prototype.findById).mockResolvedValue({
      ...order,
      items: [
        {
          productId,
          quantity: 1,
          product: { name: 'Test Product', stockQty: 100 },
        } as any,
      ],
    } as any);

    vi.mocked(
      SalesRepository.prototype.updateStatus
    ).mockResolvedValue({
      ...order,
      status: OrderStatus.CONFIRMED,
    } as any);

    // ProductService Check: need Mock ProductRepository
    // checkStock uses findById. We mocked it globally.
    // Ensure findById returns adequate data.
    vi.mocked(ProductRepository.prototype.findById).mockResolvedValue(
      {
        id: productId,
        price: 100,
        cost: 50,
        stockQty: 100,
      } as any
    );

    await salesService.confirm('so-1', companyId);

    // --- 3. Create Invoice from Order ---
    // Mock finding order for invoice creation
    vi.mocked(
      InvoiceRepository.prototype.findOrder
    ).mockResolvedValue({
      ...order,
      items: [{ productId, quantity: 1, price: 100 } as any],
    } as any);
    vi.mocked(
      DocumentNumberService.prototype.generate
    ).mockResolvedValue('INV-1001');
    vi.mocked(InvoiceRepository.prototype.create).mockImplementation(
      (d) =>
        Promise.resolve({
          ...d,
          id: 'inv-1',
          status: InvoiceStatus.DRAFT,
        } as any)
    );

    const invoice = await invoiceService.createFromSalesOrder(
      companyId,
      { orderId: 'so-1' }
    );

    expect(invoice.invoiceNumber).toBe('INV-1001');
    expect(invoice.amount).toBe(110); // 100 (Subtotal) + 10 (Tax) = 110.

    // --- 4. Post Invoice (Triggers Shipment & Journal) ---
    // Mock finding invoice
    vi.mocked(InvoiceRepository.prototype.findById).mockResolvedValue(
      {
        ...invoice,
        orderId: 'so-1',
        type: InvoiceType.INVOICE,
      } as any
    );
    // Mock Update
    vi.mocked(InvoiceRepository.prototype.update).mockResolvedValue({
      ...invoice,
      status: InvoiceStatus.POSTED,
    } as any);

    // Mock InventoryService requirements:
    // 1. Prisma find order with items
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      ...order,
      id: 'so-1',
      items: [{ productId, quantity: 1 } as any],
    } as any);
    // 2. ProductRepository findById (Already mocked globally, but strict check?)
    // 3. InventoryRepository createMovement
    vi.mocked(
      InventoryRepository.prototype.createMovement
    ).mockResolvedValue({ id: 'mov-1', type: 'OUT' } as any);
    // 4. ProductRepository updateQuantity (via ProductService.updateStock)
    vi.mocked(
      ProductRepository.prototype.incrementStock
    ).mockResolvedValue({} as any);

    // Mock AccountService requirements (via Prisma):
    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      code: '100',
    } as any);

    // Mock Config/Shape passed to Post?
    // In integration test, calling service.post directly.
    // T002 added shape/configs checking.
    // Verify we pass them if needed, or if optional, skip.
    // We will pass RETAIL.

    // Saga success
    mockInvoicePostingSaga.execute.mockResolvedValue({
      success: true,
      data: { status: InvoiceStatus.POSTED },
    });

    await invoiceService.post(
      'inv-1',
      companyId,
      BusinessShape.RETAIL
    );

    // Verify Saga Called
    expect(mockInvoicePostingSaga.execute).toHaveBeenCalled();
    // expect(JournalRepository.prototype.create).toHaveBeenCalled(); // Handled by Saga now

    // --- 5. Pay Invoice ---
    // Mock finding invoice for Payment
    vi.mocked(InvoiceRepository.prototype.findById).mockResolvedValue(
      {
        ...invoice,
        status: InvoiceStatus.POSTED,
        balance: 110,
        type: InvoiceType.INVOICE,
        invoiceNumber: 'INV-1001',
      } as any
    );
    vi.mocked(PaymentRepository.prototype.create).mockResolvedValue({
      id: 'pay-1',
      amount: 110,
    } as any);
    vi.mocked(InvoiceRepository.prototype.update).mockResolvedValue({
      ...invoice,
      status: InvoiceStatus.PAID,
      balance: 0,
    } as any);

    // Saga success
    mockPaymentPostingSaga.execute.mockResolvedValue({
      success: true,
      data: { id: 'pay-1' },
    });

    await paymentService.create(companyId, {
      invoiceId: 'inv-1',
      amount: 110,
      method: 'CASH',
    });

    // Verify Saga Called
    expect(mockPaymentPostingSaga.execute).toHaveBeenCalled();

    // Legacy assertions removed as Saga handles them
    // expect(PaymentRepository.prototype.create).toHaveBeenCalled();
    // expect(InvoiceRepository.prototype.update).toHaveBeenCalledWith(...);
    // expect(JournalRepository.prototype.create).toHaveBeenCalledTimes(2);
  });
});
