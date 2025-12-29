import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  InvoiceStatus,
  AuditLogAction,
  PaymentMethod,
  prisma,
} from '@sync-erp/database';
import { InvoiceService } from '@modules/accounting/services/invoice.service';
import { SalesOrderService } from '@modules/sales/sales-order.service';

const invoiceService = new InvoiceService();
const salesOrderService = new SalesOrderService();

const COMPANY_ID = 'test-void-invoice-001';

describe('O2C: Void Sales Invoice & Journal Reversal', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Cleanup first to ensure clean state
    await prisma.$transaction([
      prisma.auditLog.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN (SELECT id FROM "JournalEntry" WHERE "companyId" = ${COMPANY_ID})`,
      prisma.journalEntry.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.payment.deleteMany({
        where: { invoice: { companyId: COMPANY_ID } },
      }),
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
      prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.account.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.deleteMany({ where: { id: COMPANY_ID } }),
    ]);

    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test Void Invoice' },
      update: {},
    });

    // Setup Required Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '1500', name: 'VAT Receivable', type: 'ASSET' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
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

    // Setup Customer
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Customer Void Invoice',
        type: 'CUSTOMER',
        email: `customer-void-invoice-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Product with Stock
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `VOID-INV-SKU-${Date.now()}`,
        name: 'Void Invoice Test Product',
        price: 200000,
        averageCost: 100000,
        stockQty: 100, // Ensure enough stock
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
      prisma.payment.deleteMany({
        where: { invoice: { companyId: COMPANY_ID } },
      }),
      prisma.invoice.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
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
      prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.account.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.delete({ where: { id: COMPANY_ID } }),
    ]);
  });

  it('should void posted Sales Invoice and reverse journal entries', async () => {
    // 1. Create SO -> Ship
    const order = await salesOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'SALES',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 10, price: 200000 }],
    });
    await salesOrderService.confirm(
      order.id,
      COMPANY_ID,
      'test-user-id'
    );
    await salesOrderService.ship(COMPANY_ID, order.id);

    // 2. Create Invoice from SO
    const invoice = await invoiceService.createFromSalesOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        businessDate: new Date(),
        dueDate: new Date(),
      }
    );

    // 3. Post the invoice
    await invoiceService.post(
      invoice.id,
      COMPANY_ID,
      undefined,
      undefined,
      undefined,
      new Date(),
      'test-user-id'
    );
    const postedInvoice = await invoiceService.getById(
      invoice.id,
      COMPANY_ID
    );
    expect(postedInvoice?.status).toBe(InvoiceStatus.POSTED);

    // Verify Journal Exists (AR Recognition: Dr 1300, Cr 4100)
    await prisma.journalEntry.findMany({
      where: {
        companyId: COMPANY_ID,
        sourceId: { in: [invoice.id, `${invoice.id}:reversal`] },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 4. Void Invoice
    const reason = 'Customer requested cancellation';
    await invoiceService.void(
      invoice.id,
      COMPANY_ID,
      'test-user-id',
      reason,
      ['*:*'] // Admin permissions for test
    );

    // 5. Verify Invoice Status VOIDED
    const voidedInvoice = await invoiceService.getById(
      invoice.id,
      COMPANY_ID
    );
    expect(voidedInvoice?.status).toBe(InvoiceStatus.VOID);

    // 6. Verify Reversal Journal Created
    const allJournals_after_void = await prisma.journalEntry.findMany(
      {
        where: {
          companyId: COMPANY_ID,
          sourceId: { in: [invoice.id, `${invoice.id}:reversal`] },
        },
        include: { lines: { include: { account: true } } },
        orderBy: { createdAt: 'asc' },
      }
    );

    // We expect at least 2 journals now (original + reversal entry)
    expect(allJournals_after_void.length).toBeGreaterThanOrEqual(2);

    // Check audit log for reason
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        companyId: COMPANY_ID,
        entityId: invoice.id,
        action: AuditLogAction.INVOICE_VOIDED,
      },
    });
    expect(auditLogs.length).toBeGreaterThan(0);
    expect(
      auditLogs[auditLogs.length - 1].payloadSnapshot
    ).toMatchObject({
      reason,
    });
  });

  it('should fail to void DRAFT invoice', async () => {
    const order = await salesOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'SALES',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 5, price: 200000 }],
    });
    await salesOrderService.confirm(
      order.id,
      COMPANY_ID,
      'test-user-id'
    );
    await salesOrderService.ship(COMPANY_ID, order.id);

    const invoice = await invoiceService.createFromSalesOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        businessDate: new Date(),
        dueDate: new Date(),
      }
    );

    // Try to void without posting
    await expect(
      invoiceService.void(
        invoice.id,
        COMPANY_ID,
        'test-user-id',
        'reason',
        ['*:*']
      )
    ).rejects.toThrow();
  });

  it('should fail to void invoice with payments', async () => {
    const order = await salesOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'SALES',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 5, price: 200000 }],
    });
    await salesOrderService.confirm(
      order.id,
      COMPANY_ID,
      'test-user-id'
    );
    await salesOrderService.ship(COMPANY_ID, order.id);

    const invoice = await invoiceService.createFromSalesOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        businessDate: new Date(),
        dueDate: new Date(),
      }
    );

    await invoiceService.post(
      invoice.id,
      COMPANY_ID,
      undefined,
      undefined,
      undefined,
      new Date(),
      'test-user-id'
    );

    // Create payment
    await prisma.payment.create({
      data: {
        companyId: COMPANY_ID,
        invoiceId: invoice.id,
        amount: 1000000,
        date: new Date(),
        method: PaymentMethod.CASH,
      },
    });

    // Try to void with payment
    await expect(
      invoiceService.void(
        invoice.id,
        COMPANY_ID,
        'test-user-id',
        'reason',
        ['*:*']
      )
    ).rejects.toThrow();
  });
});
