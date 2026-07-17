import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  OrderStatus,
  PaymentStatus,
  InvoiceStatus,
  PaymentTerms,
} from '@sync-erp/database';
import { PurchaseOrderService } from '../../src/modules/procurement/purchase-order.service';
import { InventoryService } from '../../src/modules/inventory/inventory.service';
import { BillService } from '../../src/modules/accounting/services/bill.service';
import { UpfrontPaymentService } from '../../src/modules/procurement/upfront-payment.service';

const procurementService = new PurchaseOrderService();
const inventoryService = new InventoryService();
const billService = new BillService();
const upfrontPaymentService = new UpfrontPaymentService();

const COMPANY_ID = 'test-e2e-upfront-001';
const ACTOR_ID = 'test-e2e-user';

describe('E2E: Cash Upfront Payment Flow', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // 1. Clean up
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
      prisma.company.deleteMany({ where: { id: COMPANY_ID } }),
    ]);

    // 2. Setup Company
    await prisma.company.create({
      data: {
        id: COMPANY_ID,
        name: 'E2E Upfront Company',
      },
    });

    // 3. Setup Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '1600', name: 'Advances to Supplier', type: 'ASSET' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
      { code: '2105', name: 'GRNI Accrued', type: 'LIABILITY' },
    ];

    for (const acc of accounts) {
      await prisma.account.create({
        data: {
          companyId: COMPANY_ID,
          code: acc.code,
          name: acc.name,
          type: acc.type as import("@sync-erp/database").AccountType,
        },
      });
    }

    // 4. Setup Partner
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'E2E Supplier',
        type: 'SUPPLIER',
        email: `e2e-supplier-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // 5. Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: 'E2E-Product',
        name: 'E2E Product',
        price: 200000,
        averageCost: 150000,
        stockQty: 0,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup in proper FK order - use raw SQL for complex dependencies
    try {
      // Delete JournalLines first (references Account)
      await prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN (SELECT id FROM "JournalEntry" WHERE "companyId" = ${COMPANY_ID})`;
      // Delete JournalEntries
      await prisma.journalEntry.deleteMany({
        where: { companyId: COMPANY_ID },
      });
      // Delete Payments (references Invoice)
      await prisma.payment.deleteMany({
        where: { companyId: COMPANY_ID },
      });
      // Delete Invoices (references Partner, Order)
      await prisma.invoice.deleteMany({
        where: { companyId: COMPANY_ID },
      });
      // Delete InventoryMovements
      await prisma.inventoryMovement.deleteMany({
        where: { companyId: COMPANY_ID },
      });
      // Delete FulfillmentItems (references Fulfillment)
      await prisma.fulfillmentItem.deleteMany({
        where: { fulfillment: { companyId: COMPANY_ID } },
      });
      // Delete Fulfillments (references Order)
      await prisma.fulfillment.deleteMany({
        where: { companyId: COMPANY_ID },
      });
      // Delete AuditLogs
      await prisma.auditLog.deleteMany({
        where: { companyId: COMPANY_ID },
      });
      // Delete OrderItems (references Order, Product)
      await prisma.orderItem.deleteMany({
        where: { order: { companyId: COMPANY_ID } },
      });
      // Delete Orders (references Partner)
      await prisma.order.deleteMany({
        where: { companyId: COMPANY_ID },
      });
      // Delete Products
      await prisma.product.deleteMany({
        where: { companyId: COMPANY_ID },
      });
      // Delete Accounts (now safe since JournalLine is deleted)
      await prisma.account.deleteMany({
        where: { companyId: COMPANY_ID },
      });
      // Delete Partners (now safe since Invoice and Order are deleted)
      await prisma.partner.deleteMany({
        where: { companyId: COMPANY_ID },
      });
      // Delete Company
      await prisma.company.deleteMany({ where: { id: COMPANY_ID } });
    } catch {
      // Ignore cleanup errors in tests
    }
  });

  it('Complete P2P flow: PO -> Pay -> GRN -> Bill -> Auto Settle', async () => {
    // 1. Create PO (Upfront)
    const order = await procurementService.create(
      COMPANY_ID,
      {
        partnerId,
        items: [{ productId, quantity: 5, price: 200000 }], // Total 1,000,000
        type: 'PURCHASE',
        paymentTerms: 'UPFRONT',
      },
      undefined,
      ACTOR_ID
    );
    expect(order.totalAmount.toNumber()).toBe(1000000);
    expect(order.paymentTerms).toBe(PaymentTerms.UPFRONT);
    expect(order.status).toBe(OrderStatus.DRAFT);

    // 2. Confirm PO
    await procurementService.confirm(order.id, COMPANY_ID, ACTOR_ID);

    // 3. Register Payment (Full)
    const payment = await upfrontPaymentService.registerPayment(
      COMPANY_ID,
      {
        orderId: order.id,
        amount: 1000000,
        method: 'BANK',
      },
      ACTOR_ID
    );
    expect(payment.paymentType).toBe('UPFRONT');

    // Verify Journal: Dr 1600, Cr 1200
    const payJournals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID, sourceId: payment.id },
      include: { lines: { include: { account: true } } },
    });
    expect(payJournals).toHaveLength(1);
    const payDr = payJournals[0].lines.find(
      (l) => l.account.code === '1600'
    );
    expect(Number(payDr?.debit)).toBe(1000000);

    // 4. Create & Post GRN
    const orderItems = await procurementService.getItems(order.id);
    const grn = await inventoryService.createGRN(COMPANY_ID, {
      purchaseOrderId: order.id,
      items: [{ productId: orderItems[0].productId, quantity: 5 }],
    });
    const postedGrn = await inventoryService.postGRN(
      COMPANY_ID,
      grn.id,
      undefined,
      ACTOR_ID
    );
    expect(postedGrn.status).toBe('POSTED');

    // Verify GRN Journal: Dr 1400, Cr 2105
    const grnJournals = await prisma.journalEntry.findMany({
      where: {
        companyId: COMPANY_ID,
        reference: `GRN:${postedGrn.number}`,
      },
      include: { lines: { include: { account: true } } },
    });
    expect(grnJournals).toHaveLength(1);
    const grnDr = grnJournals[0].lines.find(
      (l) => l.account.code === '1400'
    );
    const grnCr = grnJournals[0].lines.find(
      (l) => l.account.code === '2105'
    );
    expect(Number(grnDr?.debit)).toBe(1000000);
    expect(Number(grnCr?.credit)).toBe(1000000);

    // 5. Create & Post Bill
    const bill = await billService.createFromPurchaseOrder(
      COMPANY_ID,
      {
        orderId: order.id,
      }
    );
    const postedBill = await billService.post(
      bill.id,
      COMPANY_ID,
      undefined,
      ACTOR_ID
    );

    // 6. Verify Auto-Settlement
    expect(postedBill.status).toBe(InvoiceStatus.PAID); // Should be PAID due to full settlement
    expect(Number(postedBill.balance)).toBe(0);

    // Verify Settlement Journal: Dr 2100 (AP), Cr 1600 (Advances)
    const settleJournals = await prisma.journalEntry.findMany({
      where: {
        companyId: COMPANY_ID,
        sourceType: 'PAYMENT',
        reference: { contains: 'Settle' }, // Or check sourceId convention
      },
      include: { lines: { include: { account: true } } },
      orderBy: { createdAt: 'desc' },
    });
    // Filter specifically for this bill/payment if needed, but in clean env checks easier
    const settleJournal = settleJournals.find((j) =>
      j.reference?.includes(postedBill.invoiceNumber!)
    );
    expect(settleJournal).toBeDefined();

    const settleDr = settleJournal?.lines.find(
      (l) => l.account.code === '2100'
    );
    const settleCr = settleJournal?.lines.find(
      (l) => l.account.code === '1600'
    );
    expect(Number(settleDr?.debit)).toBe(1000000); // Clears AP
    expect(Number(settleCr?.credit)).toBe(1000000); // Clears Advances

    // 7. Verify Final Balances
    const finalOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(finalOrder?.paymentStatus).toBe(PaymentStatus.SETTLED);
    expect(finalOrder?.status).toBe(OrderStatus.COMPLETED); // Completed by GRN and Bill logic
  });
});
