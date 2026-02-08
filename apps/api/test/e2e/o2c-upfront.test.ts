/**
 * E2E Test: Cash Upfront Sales - Complete Order-to-Cash with Customer Deposit
 *
 * Tests the complete O2C flow with upfront payment:
 * 1. Create SO with UPFRONT terms
 * 2. Confirm SO
 * 3. Register customer deposit (Dr Bank, Cr 2200)
 * 4. Create and post Invoice (triggers auto-settlement)
 * 5. Verify Invoice is paid and deposit settled
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  OrderStatus,
  InvoiceStatus,
  PaymentTerms,
  PaymentStatus,
} from '@sync-erp/database';
import { SalesOrderService } from '../../src/modules/sales/sales-order.service';
import { CustomerDepositService } from '../../src/modules/sales/customer-deposit.service';
import { InvoiceService } from '../../src/modules/accounting/services/invoice.service';

const salesOrderService = new SalesOrderService();
const customerDepositService = new CustomerDepositService();
const invoiceService = new InvoiceService();

const COMPANY_ID = 'test-o2c-upfront-e2e-001';
const ACTOR_ID = 'test-user-e2e-001';

describe('E2E: Cash Upfront Sales - Complete O2C Flow', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'E2E Cash Upfront Test Company',
      },
      update: {},
    });

    // Setup Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
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
          ...acc,
          isActive: true,
        } as any,
      });
    }

    // Setup Customer
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'E2E Upfront Customer',
        type: 'CUSTOMER',
        email: `e2e-upfront-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `E2E-UPFRONT-${Date.now()}`,
        name: 'E2E Upfront Product',
        price: 100000,
        averageCost: 70000,
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

  it('Complete O2C flow with customer deposit and auto-settlement', async () => {
    // 1. Create SO with UPFRONT payment terms
    const order = await salesOrderService.create(COMPANY_ID, {
      partnerId,
      items: [{ productId, quantity: 5, price: 100000 }],
      type: 'SALES',
      paymentTerms: 'UPFRONT',
    });

    expect(order.status).toBe(OrderStatus.DRAFT);
    expect(order.paymentTerms).toBe(PaymentTerms.UPFRONT);
    expect(order.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(Number(order.totalAmount)).toBe(500000);

    // 2. Confirm SO
    await salesOrderService.confirm(order.id, COMPANY_ID, ACTOR_ID);
    const confirmedOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(confirmedOrder?.status).toBe(OrderStatus.CONFIRMED);

    // 3. Register full customer deposit
    const deposit = await customerDepositService.registerDeposit(
      COMPANY_ID,
      {
        orderId: order.id,
        amount: 500000, // Full amount
        method: 'BANK',
        reference: 'E2E-DEPOSIT-001',
      },
      ACTOR_ID
    );

    expect(Number(deposit.amount)).toBe(500000);
    expect(deposit.paymentType).toBe('UPFRONT');

    // Verify deposit journal (Dr Bank, Cr 2200)
    const depositJournals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID, sourceId: deposit.id },
      include: { lines: true },
    });
    expect(depositJournals).toHaveLength(1);
    expect(depositJournals[0].reference).toContain(
      'Customer Deposit'
    );

    // Verify order updated to PAID_UPFRONT
    const paidOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(paidOrder?.paymentStatus).toBe(PaymentStatus.PAID_UPFRONT);
    expect(Number(paidOrder?.paidAmount)).toBe(500000);

    // 4. Create Invoice from SO
    const invoice = await invoiceService.createFromSalesOrder(
      COMPANY_ID,
      {
        orderId: order.id,
      }
    );

    expect(invoice.status).toBe(InvoiceStatus.DRAFT);
    expect(Number(invoice.amount)).toBe(500000);

    // 5. Post Invoice (triggers auto-settlement)
    const postedInvoice = await invoiceService.post(
      invoice.id,
      COMPANY_ID,
      undefined,
      undefined,
      undefined,
      undefined,
      ACTOR_ID
    );

    expect(postedInvoice.status).toBe(InvoiceStatus.POSTED);

    // 6. Verify auto-settlement occurred
    // Check settlement journal (Dr 2200, Cr 1300)
    const settlementJournals = await prisma.journalEntry.findMany({
      where: {
        companyId: COMPANY_ID,
        sourceId: `${deposit.id}:settlement`,
      },
      include: { lines: true },
    });

    expect(settlementJournals).toHaveLength(1);
    expect(settlementJournals[0].reference).toContain(
      'Settle Deposit'
    );

    // Verify settlement journal lines
    const settlementLines = settlementJournals[0].lines;
    expect(settlementLines).toHaveLength(2);

    // Check invoice balance is 0
    const finalInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });
    expect(Number(finalInvoice?.balance)).toBe(0);

    // Check deposit is marked as settled
    const settledDeposit = await prisma.payment.findUnique({
      where: { id: deposit.id },
    });
    expect(settledDeposit?.settlementBillId).toBe(invoice.id);

    // Check order paymentStatus is SETTLED
    const finalOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(finalOrder?.paymentStatus).toBe(PaymentStatus.SETTLED);

    // 7. Verify final account balances
    // Dr Bank 500k, Dr COGS ?, Dr AR 0 (settled), Cr 2200 0 (settled), Cr Revenue 500k
    const bankAccount = await prisma.account.findFirst({
      where: { companyId: COMPANY_ID, code: '1200' },
    });
    const depositAccount = await prisma.account.findFirst({
      where: { companyId: COMPANY_ID, code: '2200' },
    });
    const arAccount = await prisma.account.findFirst({
      where: { companyId: COMPANY_ID, code: '1300' },
    });

    // Calculate running balances from journal lines
    const bankLines = await prisma.journalLine.findMany({
      where: { accountId: bankAccount!.id },
    });
    const depositLines = await prisma.journalLine.findMany({
      where: { accountId: depositAccount!.id },
    });
    const arLines = await prisma.journalLine.findMany({
      where: { accountId: arAccount!.id },
    });

    // Bank should have +500k (debit from deposit)
    const bankBalance = bankLines.reduce(
      (sum, l) => sum + Number(l.debit) - Number(l.credit),
      0
    );
    expect(bankBalance).toBe(500000);

    // Customer Deposits should be 0 (credited on deposit, debited on settlement)
    const depositBalance = depositLines.reduce(
      (sum, l) => sum - Number(l.credit) + Number(l.debit), // Liability: credit increases
      0
    );
    expect(depositBalance).toBe(0);

    // AR should be 0 (debited on invoice post, credited on settlement)
    const arBalance = arLines.reduce(
      (sum, l) => sum + Number(l.debit) - Number(l.credit),
      0
    );
    expect(arBalance).toBe(0);
  });
});
