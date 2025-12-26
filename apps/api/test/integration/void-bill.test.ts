import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  InvoiceStatus,
  AuditLogAction,
  prisma,
} from '@sync-erp/database';
import { BillService } from '@modules/accounting/services/bill.service';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';

const billService = new BillService();
const purchaseOrderService = new PurchaseOrderService();

const COMPANY_ID = 'test-void-bill-001';

describe('P2P: Void Bill & Journal Reversal', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test Void Bill' },
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

    // Setup Supplier
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Supplier Void Bill',
        type: 'SUPPLIER',
        email: `supplier-void-bill-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `VOID-BILL-SKU-${Date.now()}`,
        name: 'Void Bill Test Product',
        price: 100000,
        averageCost: 50000,
        stockQty: 0,
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

  it('should void posted Bill and reverse journal entries', async () => {
    // 1. Create PO -> GRN
    const order = await purchaseOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'PURCHASE',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 10, price: 100000 }],
    });
    await purchaseOrderService.confirm(
      order.id,
      COMPANY_ID,
      'test-user-id'
    );
    await purchaseOrderService.receive(order.id, COMPANY_ID);

    // 2. Create Bill from PO
    const bill = await billService.createFromPurchaseOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        businessDate: new Date(),
        dueDate: new Date(),
        supplierInvoiceNumber: `INV-VOID-${Date.now()}`,
      }
    );

    // 3. Post the bill
    await billService.post(
      bill.id,
      COMPANY_ID,
      new Date(),
      'test-user-id'
    );
    const postedBill = await billService.getById(bill.id, COMPANY_ID);
    expect(postedBill?.status).toBe(InvoiceStatus.POSTED);

    // Verify Journal Exists (AP Accrual Reversal: Dr 2105, Cr 2100)
    await prisma.journalEntry.findMany({
      where: {
        companyId: COMPANY_ID,
        sourceId: { in: [bill.id, `${bill.id}:reversal`] },
      },
      // include: { lines: { include: { account: true } } }, // not needed for length check if we did checks
      orderBy: { createdAt: 'asc' },
    });

    // 4. Void Bill
    const reason = 'Incorrect invoice number';
    await billService.void(
      bill.id,
      COMPANY_ID,
      'test-user-id',
      reason
    );

    // 5. Verify Bill Status VOIDED
    const voidedBill = await billService.getById(bill.id, COMPANY_ID);
    expect(voidedBill?.status).toBe(InvoiceStatus.VOID);

    // 6. Verify Reversal Journal Created
    // Verify Journal Exists (AP Accrual Reversal: Dr 2105, Cr 2100)
    const allJournals_after_void = await prisma.journalEntry.findMany(
      {
        where: {
          companyId: COMPANY_ID,
          sourceId: { in: [bill.id, `${bill.id}:reversal`] },
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
        entityId: bill.id,
        action: AuditLogAction.BILL_VOIDED,
      },
    });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].payloadSnapshot).toMatchObject({ reason });
  });

  it('should fail to void Bill with payments', async () => {
    // 1. Create PO -> GRN -> Bill -> Post
    const order = await purchaseOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'PURCHASE',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 5, price: 100000 }],
    });
    await purchaseOrderService.confirm(
      order.id,
      COMPANY_ID,
      'test-user-id'
    );
    await purchaseOrderService.receive(order.id, COMPANY_ID);

    const bill = await billService.createFromPurchaseOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        businessDate: new Date(),
        dueDate: new Date(),
        supplierInvoiceNumber: `INV-PAID-${Date.now()}`,
      }
    );
    await billService.post(
      bill.id,
      COMPANY_ID,
      new Date(),
      'test-user-id'
    );

    // 2. Pay Bill
    // We need to inject PaymentService here or mock it to pay
    // Direct Prisma create for speed
    await prisma.payment.create({
      data: {
        companyId: COMPANY_ID,
        invoiceId: bill.id,
        amount: 500000,
        method: 'BANK_TRANSFER',
        date: new Date(),
        reference: 'PAY-001',
      },
    });

    // Update bill balance & status (normally done by service)
    await prisma.invoice.update({
      where: { id: bill.id },
      data: {
        status: InvoiceStatus.PAID,
        balance: 0,
      },
    });

    // 3. Attempt to Void - Should fail
    await expect(
      billService.void(
        bill.id,
        COMPANY_ID,
        'test-user-id',
        'Void paid bill'
      )
    ).rejects.toThrow();
  });
});
