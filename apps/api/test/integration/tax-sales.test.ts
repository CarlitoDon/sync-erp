import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma } from '@sync-erp/database';
import { InvoiceService } from '../../src/modules/accounting/services/invoice.service';


const invoiceService = new InvoiceService();

const COMPANY_ID = 'test-tax-sales-001';

describe('US1: Flexible Tax Selection (Sales)', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Tax Test Company' },
      update: {},
    });

    // 2. Setup Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '4100', name: 'Sales Revenue', type: 'REVENUE' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
      { code: '2300', name: 'VAT Payable', type: 'LIABILITY' }, // Output VAT
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
          type: acc.type as import("@sync-erp/database").AccountType,
          isActive: true,
        },
      });
    }

    // 3. Setup Partner
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Tax Customer',
        type: 'CUSTOMER',
        email: `taxcust-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // 4. Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `TAX-PROD-${Date.now()}`,
        name: 'Taxable Product',
        price: 100000,
        stockQty: 100,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup cascade
    await prisma.journalEntry.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.invoice.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    // Delete Fulfillments first
    await prisma.fulfillmentItem.deleteMany({
      where: { fulfillment: { companyId: COMPANY_ID } },
    });
    await prisma.fulfillment.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.orderItem.deleteMany({
      where: { order: { companyId: COMPANY_ID } },
    });
    await prisma.order.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.product.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.account.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.partner.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.company.delete({ where: { id: COMPANY_ID } });
  });

  it('should split Invoice Journal into AR, Revenue, and Tax Payable when Tax Rate is selected', async () => {
    // 1. Create Sales Order with 11% Tax
    // Amount: 100,000 * 2 = 200,000.
    // Tax: 11%.
    const order = await prisma.order.create({
      data: {
        companyId: COMPANY_ID,
        orderNumber: `SO-TAX-${Date.now()}`,
        status: 'CONFIRMED', // Skip validation logic for test simplicity
        type: 'SALES',
        partnerId,
        totalAmount: 200000,
        taxRate: 11, // PPN 11%
        items: {
          create: [{ productId, quantity: 2, price: 100000 }],
        },
      },
    });

    // 2. Create Invoice
    const invoice = await invoiceService.createFromSalesOrder(
      COMPANY_ID,
      {
        orderId: order.id,
      }
    );

    expect(Number(invoice.subtotal)).toBe(200000);
    expect(Number(invoice.taxRate)).toBe(11);
    expect(Number(invoice.taxAmount)).toBe(22000); // 200,000 * 0.11
    expect(Number(invoice.amount)).toBe(222000);

    // 3. Post Invoice -> Triggers Journal
    await invoiceService.post(invoice.id, COMPANY_ID);

    // 4. Verify Journal
    const journals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    });
    const invJournal = journals.find((j) =>
      j.reference?.includes(invoice.invoiceNumber!)
    );

    expect(invJournal).toBeDefined();
    expect(invJournal!.lines).toHaveLength(3); // AR, Rev, Tax

    // Verify Lines
    const arLine = invJournal!.lines.find(
      (l) => l.account.code === '1300'
    );
    const revLine = invJournal!.lines.find(
      (l) => l.account.code === '4100'
    );
    const taxLine = invJournal!.lines.find(
      (l) => l.account.code === '2300'
    );

    expect(Number(arLine?.debit)).toBe(222000); // Full Amount
    expect(Number(revLine?.credit)).toBe(200000); // Net Sales
    expect(Number(taxLine?.credit)).toBe(22000); // VAT Output
  });

  it('should NOT record Tax Payable if Tax Rate is 0', async () => {
    // 1. Create Sales Order with 0% Tax
    const order = await prisma.order.create({
      data: {
        companyId: COMPANY_ID,
        orderNumber: `SO-NOTAX-${Date.now()}`,
        status: 'CONFIRMED',
        type: 'SALES',
        partnerId,
        totalAmount: 100000,
        taxRate: 0,
        items: {
          create: [{ productId, quantity: 1, price: 100000 }],
        },
      },
    });

    // 2. Create Invoice
    const invoice = await invoiceService.createFromSalesOrder(
      COMPANY_ID,
      {
        orderId: order.id,
      }
    );

    expect(Number(invoice.taxAmount)).toBe(0);
    expect(Number(invoice.amount)).toBe(100000);

    // 3. Post
    await invoiceService.post(invoice.id, COMPANY_ID);

    // 4. Verify Journal
    const journals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    });
    const invJournal = journals.find((j) =>
      j.reference?.includes(invoice.invoiceNumber!)
    );

    expect(invJournal!.lines).toHaveLength(2); // AR + Rev only

    const taxLine = invJournal!.lines.find(
      (l) => l.account.code === '2300'
    );
    expect(taxLine).toBeUndefined();
  });
});
