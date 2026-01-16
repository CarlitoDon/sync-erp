import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  OrderStatus,
  InvoiceStatus,
  JournalSourceType,
  PaymentStatus,
  JournalEntry,
  JournalLine,
} from '@sync-erp/database';
import { InvoiceService } from '../../src/modules/accounting/services/invoice.service';
import { PaymentService } from '../../src/modules/accounting/services/payment.service';
import { JournalService } from '../../src/modules/accounting/services/journal.service';
import { SalesOrderService } from '../../src/modules/sales/sales-order.service';
import { CustomerDepositService } from '../../src/modules/sales/customer-deposit.service';

const invoiceService = new InvoiceService();
const paymentService = new PaymentService();
const journalService = new JournalService();
const salesOrderService = new SalesOrderService();
const customerDepositService = new CustomerDepositService();

const COMPANY_ID = 'test-o2c-tempo-dp-001';
const ACTOR_ID = 'test-user-001';

describe('O2C Flow: Tax + Tempo + Down Payment', () => {
  let productId: string;
  let partnerId: string;
  let invoiceId: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test O2C Tempo DP Company' },
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
        name: 'Test Setup Customer',
        type: 'CUSTOMER',
        email: `customer-tempo-dp-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // 4. Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `TEMPO-DP-SKU-${Date.now()}`,
        name: 'Test Tempo DP Product',
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

  it('Should process O2C with Tax, Tempo (NET30), and Down Payment', async () => {
    // 1. Create SO (NET30, Tax 11%)
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

    // 2. Confirm SO
    await salesOrderService.confirm(order.id, COMPANY_ID, ACTOR_ID);

    // 3. Register Down Payment (20% = 222,000)
    // Previously blocked for NET30, now allowed.
    const deposit = await customerDepositService.registerDeposit(
      COMPANY_ID,
      {
        orderId: order.id,
        amount: 222000,
        method: 'BANK_TRANSFER',
      },
      ACTOR_ID
    );
    expect(Number(deposit.amount)).toBe(222000);

    // Verify Order Payment Status
    const orderAfterDeposit = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(Number(orderAfterDeposit?.paidAmount)).toBe(222000);
    expect(orderAfterDeposit?.paymentStatus).toBe(
      PaymentStatus.PARTIAL
    );

    // Verify Deposit Journal (Dr Bank, Cr Customer Deposits)
    const depositJournal = await prisma.journalEntry.findFirst({
      where: { companyId: COMPANY_ID, sourceId: deposit.id },
      include: { lines: { include: { account: true } } },
    });
    expect(depositJournal).toBeDefined();
    const bankLine = depositJournal?.lines.find(
      (l) => l.account.code === '1200'
    );
    const liabilityLine = depositJournal?.lines.find(
      (l) => l.account.code === '2200'
    );
    expect(Number(bankLine?.debit)).toBe(222000);
    expect(Number(liabilityLine?.credit)).toBe(222000);

    // 4. Create Final Invoice
    // Should inherit tax settings
    const invoice = await invoiceService.createFromSalesOrder(
      COMPANY_ID,
      {
        orderId: order.id,
      }
    );
    invoiceId = invoice.id;
    expect(Number(invoice.amount)).toBe(1110000);
    expect(Number(invoice.balance)).toBe(1110000); // Balance is full initially

    // 5. Post Invoice -> Should auto-settle the deposit
    await invoiceService.post(
      invoice.id,
      COMPANY_ID,
      undefined,
      undefined,
      undefined,
      undefined,
      ACTOR_ID
    );

    // 6. Verify Settlement
    const updatedInvoice = await invoiceService.getById(
      invoiceId,
      COMPANY_ID
    );
    // Balance should be Total - Deposit = 1,110,000 - 222,000 = 888,000
    expect(Number(updatedInvoice?.balance)).toBe(888000);
    expect(updatedInvoice?.status).toBe(InvoiceStatus.POSTED); // Still posted, not paid yet

    // 7. Verify Settlement Journal (Dr Customer Deposits, Cr AR)
    // Refresh journals list first
    const journals = await journalService.list(COMPANY_ID);

    // Invoice Journal
    const invJournal = journals.find(
      (j) =>
        j.sourceType === JournalSourceType.INVOICE &&
        j.sourceId === invoiceId
    );
    expect(invJournal).toBeDefined();
    // Dr AR 1,110,000
    // Cr Sales 1,000,000
    // Cr Tax 110,000

    // Settlement Journal
    // The settlement uses the PAYMENT ID as sourceId in current implementation?
    // verify 'postSettleCustomerDeposit' implementation in journal service if needed
    // But we can find by account codes 2200 Dr and 1300 Cr
    const settJournal = journals.find(
      (j: JournalEntry) =>
        (j as any).lines.some(
          (l: JournalLine) => (l as any).account?.code === '2200' && Number(l.debit) > 0
        ) &&
        (j as any).lines.some(
          (l: JournalLine) =>
            (l as any).account?.code === '1300' && Number(l.credit) > 0
        )
    );
    expect(settJournal).toBeDefined();
    // journalService.list output structure usually has accounts included or transformed.
    // Assuming list() returns lines with account info.
    const settDebit = (settJournal as any)?.lines.find(
      (l: any) => l.account.code === '2200'
    );
    expect(Number(settDebit?.debit)).toBe(222000);

    // 8. Pay remaining balance
    const payment = await paymentService.create(COMPANY_ID, {
      invoiceId: invoice.id,
      amount: 888000,
      method: 'BANK_TRANSFER',
    });
    expect(Number(payment.amount)).toBe(888000);

    const finalInvoice = await invoiceService.getById(
      invoiceId,
      COMPANY_ID
    );
    expect(Number(finalInvoice?.balance)).toBe(0);
    expect(finalInvoice?.status).toBe(InvoiceStatus.PAID);
  });
});
