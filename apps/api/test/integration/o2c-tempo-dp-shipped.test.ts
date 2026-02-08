import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  OrderStatus,
  InvoiceStatus,
  PaymentStatus,
  DocumentStatus,
} from '@sync-erp/database';
import { InvoiceService } from '../../src/modules/accounting/services/invoice.service';
import { PaymentService } from '../../src/modules/accounting/services/payment.service';
import { SalesOrderService } from '../../src/modules/sales/sales-order.service';
import { CustomerDepositService } from '../../src/modules/sales/customer-deposit.service';
import { InventoryService } from '../../src/modules/inventory/inventory.service';

const invoiceService = new InvoiceService();
const paymentService = new PaymentService();
const salesOrderService = new SalesOrderService();
const customerDepositService = new CustomerDepositService();
const inventoryService = new InventoryService();

const COMPANY_ID = 'test-o2c-tempo-dp-shipped-001';
const ACTOR_ID = 'test-user-001';

/**
 * BUG REPRODUCTION: O2C with Tax + Tempo + DP where Shipment happens BEFORE Invoice Post
 *
 * Real-world scenario:
 * 1. Create SO with NET30, Tax 11%
 * 2. Confirm SO
 * 3. Register Down Payment (20%)
 * 4. Ship goods (Shipment created and posted)
 * 5. Create Invoice from SO
 * 6. Post Invoice --> ERROR: "Cannot create fulfillment for order in status: SHIPPED"
 *
 * The bug: invoice.post() tries to create Shipment automatically,
 * but Order is already SHIPPED because we shipped manually before invoicing.
 *
 * Expected behavior: invoice.post() should detect existing shipment and skip auto-shipment.
 */
describe('BUG: O2C Flow with Shipment Before Invoice Post', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test O2C Shipped Bug Company' },
      update: {},
    });

    // 2. Setup Required Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
      { code: '2200', name: 'Customer Deposits', type: 'LIABILITY' },
      { code: '2300', name: 'VAT Payable', type: 'LIABILITY' },
      { code: '4100', name: 'Sales Revenue', type: 'REVENUE' },
      { code: '5000', name: 'COGS', type: 'EXPENSE' },
    ];

    for (const acc of accounts) {
      await prisma.account.upsert({
        where: {
          companyId_code: { companyId: COMPANY_ID, code: acc.code },
        },
        update: {},
        create: {
          companyId: COMPANY_ID,
          code: acc.code,
          name: acc.name,
          type: acc.type as any,
          isActive: true,
        },
      });
    }

    // 3. Setup Partner (Customer)
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Shipped Bug Customer',
        type: 'CUSTOMER',
        email: `customer-shipped-bug-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // 4. Setup Product with stock
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `SHIPPED-BUG-SKU-${Date.now()}`,
        name: 'Test Shipped Bug Product',
        price: 100000,
        averageCost: 50000,
        stockQty: 100,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.$transaction([
      prisma.auditLog.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN (SELECT id FROM "JournalEntry" WHERE "companyId" = ${COMPANY_ID})`,
      prisma.journalEntry.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.payment.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.invoice.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.inventoryMovement.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.fulfillmentItem.deleteMany({
        where: { fulfillment: { companyId: COMPANY_ID } },
      }),
      prisma.fulfillment.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.orderItem.deleteMany({
        where: { order: { companyId: COMPANY_ID } },
      }),
      prisma.order.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.product.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.account.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.delete({ where: { id: COMPANY_ID } }),
    ]);
  });

  it('should post invoice even when order is already SHIPPED', async () => {
    // ================================================
    // STEP 1: Create SO with NET30, Tax 11%
    // ================================================
    // Amount: 100,000 * 10 = 1,000,000
    // Tax: 11% = 110,000
    // Total: 1,110,000
    const order = await salesOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'SALES',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 10, price: 100000 }],
      taxRate: 11,
    });
    expect(order.status).toBe(OrderStatus.DRAFT);
    expect(Number(order.totalAmount)).toBe(1110000);

    // ================================================
    // STEP 2: Confirm SO
    // ================================================
    await salesOrderService.confirm(order.id, COMPANY_ID, ACTOR_ID);
    const confirmedOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(confirmedOrder?.status).toBe(OrderStatus.CONFIRMED);

    // ================================================
    // STEP 3: Register Down Payment (20% = 222,000)
    // ================================================
    const deposit = await customerDepositService.registerDeposit(
      COMPANY_ID,
      {
        orderId: order.id,
        amount: 222000,
        method: 'BANK',
      },
      ACTOR_ID
    );
    expect(Number(deposit.amount)).toBe(222000);

    // Verify order payment status
    const orderAfterDeposit = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(Number(orderAfterDeposit?.paidAmount)).toBe(222000);
    expect(orderAfterDeposit?.paymentStatus).toBe(PaymentStatus.PARTIAL);

    // ================================================
    // STEP 4: Ship goods BEFORE creating invoice (Real-world scenario)
    // ================================================
    const shipment = await inventoryService.createShipment(COMPANY_ID, {
      salesOrderId: order.id,
      notes: 'Manual shipment before invoice',
      items: [{ productId, quantity: 10 }],
    });
    expect(shipment.status).toBe(DocumentStatus.DRAFT);

    // Post shipment
    await inventoryService.postShipment(COMPANY_ID, shipment.id);

    // Verify order status is now SHIPPED
    const orderAfterShipment = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(orderAfterShipment?.status).toBe(OrderStatus.SHIPPED);

    // ================================================
    // STEP 5: Create Invoice from SO
    // ================================================
    const invoice = await invoiceService.createFromSalesOrder(COMPANY_ID, {
      orderId: order.id,
    });
    expect(Number(invoice.amount)).toBe(1110000);
    expect(invoice.status).toBe(InvoiceStatus.DRAFT);

    // ================================================
    // STEP 6: Post Invoice --> THIS IS WHERE THE BUG OCCURS
    // ================================================
    // Current behavior: Error "Cannot create fulfillment for order in status: SHIPPED"
    // Expected behavior: Should detect existing shipment and skip auto-shipment
    await invoiceService.post(
      invoice.id,
      COMPANY_ID,
      undefined,
      undefined,
      undefined,
      undefined,
      ACTOR_ID
    );

    // Verify invoice is posted
    const postedInvoice = await invoiceService.getById(invoice.id, COMPANY_ID);
    expect(postedInvoice?.status).toBe(InvoiceStatus.POSTED);

    // Balance should be Total - Deposit = 1,110,000 - 222,000 = 888,000
    expect(Number(postedInvoice?.balance)).toBe(888000);

    // ================================================
    // STEP 7: Pay remaining balance
    // ================================================
    const payment = await paymentService.create(COMPANY_ID, {
      invoiceId: invoice.id,
      amount: 888000,
      method: 'BANK',
    });
    expect(Number(payment.amount)).toBe(888000);

    // Verify final state
    const finalInvoice = await invoiceService.getById(invoice.id, COMPANY_ID);
    expect(Number(finalInvoice?.balance)).toBe(0);
    expect(finalInvoice?.status).toBe(InvoiceStatus.PAID);
  });
});
