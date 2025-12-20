import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  OrderStatus,
  InvoiceStatus,
} from '@sync-erp/database';
import { InvoiceService } from '@modules/accounting/services/invoice.service';
import { PaymentService } from '@modules/accounting/services/payment.service';
import { JournalService } from '@modules/accounting/services/journal.service';
import { SalesService } from '@modules/sales/sales.service';

const invoiceService = new InvoiceService();
const paymentService = new PaymentService();
const journalService = new JournalService();
const salesService = new SalesService();

const COMPANY_ID = 'test-o2c-integration-001';
const ACTOR_ID = 'test-user-001';

describe('Standard O2C Flow (Order-to-Cash)', () => {
  let productId: string;
  let partnerId: string;
  let orderId: string;
  let invoiceId: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test O2C Company' },
      update: {},
    });

    // 2. Setup Required Accounts (must match JournalService account codes)
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '1500', name: 'VAT Receivable', type: 'ASSET' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
      { code: '2105', name: 'GRNI Accrued', type: 'LIABILITY' },
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
        name: 'Test Customer O2C',
        type: 'CUSTOMER',
        email: `customer-o2c-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // 4. Setup Product with Stock
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `O2C-SKU-${Date.now()}`,
        name: 'Test O2C Product',
        price: 100000,
        averageCost: 60000,
        stockQty: 100,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup in proper order
    await prisma.$transaction([
      prisma.auditLog.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      // Delete journal lines first (they reference entries)
      prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN (SELECT id FROM "JournalEntry" WHERE "companyId" = ${COMPANY_ID})`,
      prisma.journalEntry.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.payment.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.invoice.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.inventoryMovement.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      // Delete Shipments first
      prisma.shipmentItem.deleteMany({
        where: { shipment: { companyId: COMPANY_ID } },
      }),
      prisma.shipment.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.goodsReceiptItem.deleteMany({
        where: { goodsReceipt: { companyId: COMPANY_ID } },
      }),
      prisma.goodsReceipt.deleteMany({
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

  describe('US1: Complete Order-to-Cash Cycle', () => {
    it('Full O2C Flow: SO -> Invoice -> Post -> Payment -> Journal', async () => {
      // Step 1: Create and confirm Sales Order
      const order = await salesService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      orderId = order.id;
      expect(order.status).toBe(OrderStatus.DRAFT);

      const confirmedOrder = await salesService.confirm(
        orderId,
        COMPANY_ID
      );
      expect(confirmedOrder.status).toBe(OrderStatus.CONFIRMED);

      // Step 2: Create Invoice from confirmed SO
      const invoice = await invoiceService.createFromSalesOrder(
        COMPANY_ID,
        {
          orderId,
          taxRate: 0.11,
        }
      );
      invoiceId = invoice.id;
      expect(invoice.status).toBe(InvoiceStatus.DRAFT);
      expect(invoice.orderId).toBe(orderId);
      expect(Number(invoice.subtotal)).toBe(500000);
      expect(Number(invoice.taxAmount)).toBe(55000);
      expect(Number(invoice.amount)).toBe(555000);

      // Step 3: Post Invoice with AuditLog and correlationId
      const correlationId = `corr-${Date.now()}`;
      const postedInvoice = await invoiceService.post(
        invoiceId,
        COMPANY_ID,
        undefined,
        undefined,
        undefined,
        undefined,
        ACTOR_ID,
        correlationId
      );
      expect(postedInvoice.status).toBe(InvoiceStatus.POSTED);

      // Verify AuditLog
      const auditLogs = await prisma.auditLog.findMany({
        where: { companyId: COMPANY_ID, entityId: invoiceId },
      });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].action).toBe('INVOICE_POSTED');
      expect(auditLogs[0].correlationId).toBe(correlationId);

      // Step 4: Verify Journal entries
      let journals = await journalService.list(COMPANY_ID);
      const invoiceJournal = journals.find(
        (j: any) =>
          j.sourceType === 'INVOICE' && j.sourceId === invoiceId
      ) as any;
      expect(invoiceJournal).toBeDefined();

      const totalDebit = invoiceJournal.lines.reduce(
        (sum: number, l: any) => sum + Number(l.debit),
        0
      );
      const totalCredit = invoiceJournal.lines.reduce(
        (sum: number, l: any) => sum + Number(l.credit),
        0
      );
      expect(totalDebit).toBeCloseTo(totalCredit, 2);

      // Step 5: Receive Payment and clear Invoice balance
      const payment = await paymentService.create(COMPANY_ID, {
        invoiceId,
        amount: 555000,
        method: 'BANK_TRANSFER' as const,
      });
      expect(Number(payment.amount)).toBe(555000);

      const updatedInvoice = await invoiceService.getById(
        invoiceId,
        COMPANY_ID
      );
      expect(Number(updatedInvoice?.balance)).toBe(0);
      expect(updatedInvoice?.status).toBe(InvoiceStatus.PAID);

      // Step 6: Verify Cash receipt journal
      journals = await journalService.list(COMPANY_ID);
      const paymentJournal = journals.find(
        (j: any) => j.sourceType === 'PAYMENT'
      ) as any;
      expect(paymentJournal).toBeDefined();

      const paymentDebit = paymentJournal.lines.reduce(
        (sum: number, l: any) => sum + Number(l.debit),
        0
      );
      const paymentCredit = paymentJournal.lines.reduce(
        (sum: number, l: any) => sum + Number(l.credit),
        0
      );
      expect(paymentDebit).toBeCloseTo(paymentCredit, 2);
    });
  });

  describe('FR-012: Invoice Balance Invariant', () => {
    it('Should prevent overpayment (balance cannot be negative)', async () => {
      // Create another invoice for this test
      const order2 = await salesService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 1, price: 100000 }],
      });
      await salesService.confirm(order2.id, COMPANY_ID);

      const invoice2 = await invoiceService.createFromSalesOrder(
        COMPANY_ID,
        {
          orderId: order2.id,
        }
      );

      await invoiceService.post(
        invoice2.id,
        COMPANY_ID,
        undefined,
        undefined,
        undefined,
        undefined,
        ACTOR_ID
      );

      // Try to pay more than the balance
      await expect(
        paymentService.create(COMPANY_ID, {
          invoiceId: invoice2.id,
          amount: 200000, // More than invoice amount
          method: 'CASH' as const,
        })
      ).rejects.toThrow(/exceeds/i);
    });
  });
});
