import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  OrderStatus,
  InvoiceStatus,
  InvoiceType,
} from '@sync-erp/database';
import { InvoiceService } from '../../src/modules/accounting/services/invoice.service';
import { PaymentService } from '../../src/modules/accounting/services/payment.service';
import { JournalService } from '../../src/modules/accounting/services/journal.service';
import { SalesOrderService } from '../../src/modules/sales/sales-order.service';

const invoiceService = new InvoiceService();
const paymentService = new PaymentService();
const journalService = new JournalService();
const salesOrderService = new SalesOrderService();

const COMPANY_ID = 'test-o2c-dp-deduction-001';
const ACTOR_ID = 'test-user-001';

describe('O2C Flow: DP Deduction in Final Invoice', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Test O2C DP Deduction Company',
      },
      update: {},
    });

    // 2. Setup Required Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '1500', name: 'Input VAT', type: 'ASSET' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
      { code: '2105', name: 'Accrued Liability', type: 'LIABILITY' },
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
          isActive: true, // Phase 1: Accounts active by default
        },
      });
    }

    // 3. Setup Partner
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Customer',
        type: 'CUSTOMER',
        email: `customer-dp-deduct-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // 4. Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `DP-DEDUCT-SKU-${Date.now()}`,
        name: 'Test Product',
        price: 100000,
        averageCost: 50000,
        stockQty: 100,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
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

  it('Should deduct DP from Final Invoice amount and post correct journal', async () => {
    // 1. Create SO (NET30, 20% DP, Tax 11%)
    // Amount: 100,000 * 10 = 1,000,000
    // Tax: 11% = 110,000
    // Total: 1,110,000
    // DP: 20% = 222,000
    const order = await salesOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'SALES',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 10, price: 100000 }],
      taxRate: 11,
      dpPercent: 20,
    });
    expect(order.status).toBe(OrderStatus.DRAFT);
    expect(Number(order.totalAmount)).toBe(1110000);
    expect(Number(order.dpAmount)).toBe(222000);

    // 2. Confirm SO -> Should auto-create DP Invoice
    await salesOrderService.confirm(order.id, COMPANY_ID, ACTOR_ID);

    // Verify DP Invoice
    const dpInvoice = await prisma.invoice.findFirst({
      where: {
        orderId: order.id,
        companyId: COMPANY_ID,
        type: InvoiceType.INVOICE, // It's an Invoice in O2C
        notes: { contains: 'Down Payment' }, // Or check isDownPayment flag if exposed in Prisma
      },
    });
    expect(dpInvoice).toBeDefined();
    expect(Number(dpInvoice?.amount)).toBe(222000);
    expect(dpInvoice?.status).toBe(InvoiceStatus.DRAFT);

    // 3. Post & Pay DP Invoice
    // Post
    await invoiceService.post(
      dpInvoice!.id,
      COMPANY_ID,
      undefined,
      undefined,
      undefined,
      undefined,
      ACTOR_ID
    );
    // Pay
    await paymentService.create(COMPANY_ID, {
      invoiceId: dpInvoice!.id,
      amount: 222000,
      method: 'BANK_TRANSFER',
    });

    // 4. Create Final Invoice
    // Expectation: Amount should be Total (1,110,000) - DP (222,000) = 888,000
    // Balance should be same (888,000)
    const finalInvoice = await invoiceService.createFromSalesOrder(
      COMPANY_ID,
      { orderId: order.id }
    );

    // THIS IS THE KEY CHECK FOR THE OPTIMIZATION
    expect(Number(finalInvoice.amount)).toBe(888000);
    expect(Number(finalInvoice.balance)).toBe(888000);
    expect(Number(finalInvoice.subtotal)).toBe(1000000); // Subtotal remains full
    expect(Number(finalInvoice.taxAmount)).toBe(110000); // Tax remains full

    // 5. Post Final Invoice
    // Expectation: Journal handles the deduction using Customer Deposits (2200)
    await invoiceService.post(
      finalInvoice.id,
      COMPANY_ID,
      undefined,
      undefined,
      undefined,
      undefined,
      ACTOR_ID
    );

    // 6. Verify Journal
    // Dr AR (1300): 888,000
    // Dr Deposit (2200): 222,000
    // Cr Sales (4100): 1,000,000
    // Cr VAT Payable (2300): 110,000
    const journals = await journalService.list(COMPANY_ID);
    const invoiceJournal = journals.find(
      (j) => j.sourceId === finalInvoice.id
    );
    expect(invoiceJournal).toBeDefined();

    const arLine = invoiceJournal?.lines.find(
      (l) => l.account.code === '1300'
    );
    const depositLine = invoiceJournal?.lines.find(
      (l) => l.account.code === '2200'
    );
    const salesLine = invoiceJournal?.lines.find(
      (l) => l.account.code === '4100'
    );
    const taxLine = invoiceJournal?.lines.find(
      (l) => l.account.code === '2300'
    );

    expect(Number(arLine?.debit)).toBe(888000);
    expect(Number(depositLine?.debit)).toBe(222000);
    expect(Number(salesLine?.credit)).toBe(1000000);
    expect(Number(taxLine?.credit)).toBe(110000);
  });
});
