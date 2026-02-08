import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  InvoiceStatus,
  PaymentTerms,
} from '@sync-erp/database';
import { BillService } from '@modules/accounting/services/bill.service';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';
import { PaymentService } from '@modules/accounting/services/payment.service';

const billService = new BillService();
const purchaseOrderService = new PurchaseOrderService();
const paymentService = new PaymentService();

const COMPANY_ID = 'test-p2p-payment-001';

describe('P2P: Payment Methods (COD, Tempo+DP)', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test P2P Payments' },
      update: {},
    });

    // Setup Required Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1600', name: 'Advances to Supplier', type: 'ASSET' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '2105', name: 'GRNI Accrued', type: 'LIABILITY' },
      { code: '5000', name: 'COGS', type: 'EXPENSE' },
      { code: '1200', name: 'Bank Account', type: 'ASSET' },
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
        name: 'Test Supplier Payments',
        type: 'SUPPLIER',
        email: `supplier-pay-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `PAY-METH-SKU-${Date.now()}`,
        name: 'Payment Method Test Product',
        price: 100000,
        averageCost: 50000,
        stockQty: 0,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.$transaction([
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
      prisma.company.delete({ where: { id: COMPANY_ID } }),
    ]);
  });

  it('should handle Tempo with Down Payment flow', async () => {
    // 1. Create PO with NET30 and 20% DP
    const order = await purchaseOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'PURCHASE',
      paymentTerms: 'NET30',
      dpPercent: 20, // 20% DP
      items: [{ productId, quantity: 10, price: 100000 }], // Total 1,000,000
    });

    // DP Amount should be 200,000
    expect(Number(order.dpAmount)).toBe(200000);

    // 2. Confirm PO
    await purchaseOrderService.confirm(
      order.id,
      COMPANY_ID,
      'test-user-id'
    );

    // 3. Create DP Bill manually (Feature 041: DP Bill is now created manually)
    const dpBill = await billService.createDownPaymentBill(
      COMPANY_ID,
      order.id
    );
    expect(Number(dpBill.amount)).toBe(200000);
    expect(dpBill.notes).toContain('Down Payment');

    // 3b. Post DP Bill (Required before payment)
    const paidAmount = Number(dpBill.amount);
    // Note: DP Bills might be auto-posted or we need to post them.
    // Usually standard bills are DRAFT.
    // Let's post it.
    await billService.post(
      dpBill.id,
      COMPANY_ID,
      new Date(),
      'test-user-id'
    );

    // 4. Pay DP Bill
    await paymentService.create(COMPANY_ID, {
      invoiceId: dpBill.id,
      method: 'BANK',
      amount: paidAmount, // use precise amount
      businessDate: new Date(),
    });

    const paidDpBill = await billService.getById(
      dpBill.id,
      COMPANY_ID
    );
    expect(paidDpBill?.status).toBe(InvoiceStatus.PAID);

    // 5. Receive Goods
    await purchaseOrderService.receive(order.id, COMPANY_ID);

    // 6. Create Final Bill
    const finalBill = await billService.createFromPurchaseOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        businessDate: new Date(),
        supplierInvoiceNumber: `INV-FINAL-${Date.now()}`,
      }
    );

    // 7. Post Final Bill - Should deduct DP from balance
    // Wait, createFromPurchaseOrder calculates 'amount' based on remaining?
    // Or post logic handles settlement?
    // Gap 1 notes earlier said "DP Bill skipped 3-way match".
    // Let's see if final bill amount is reduced or if it's full amount but settled against DP.
    // Usually Final Bill is full amount (1,000,000), but we apply the DP (Advance) against it.

    await billService.post(
      finalBill.id,
      COMPANY_ID,
      new Date(),
      'test-user-id'
    );
    const postedFinal = await billService.getById(
      finalBill.id,
      COMPANY_ID
    );

    // Balance should be Total - DP = 1,000,000 - 200,000 = 800,000
    // If logic supports auto-application of DP.
    // If usage of '1600 Advances' was correct in DP Bill payment.
    expect(Number(postedFinal?.balance)).toBe(800000);
  });

  it('should handle COD (Cash On Delivery) flow', async () => {
    // 1. Create PO with COD (treated same as UPFRONT but payment later?)
    // Or maybe just NET30 with immediate payment?
    // Spec says "COD".
    // Let's assume COD creates Bill immediately upon Receipt?
    // Or normal flow: PO -> Receive -> Bill -> Pay (Same day).

    // 1. Create PO with COD terms
    const order = await purchaseOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'PURCHASE',
      paymentTerms: PaymentTerms.COD,
      items: [{ productId, quantity: 5, price: 100000 }],
    });

    // 2. Confirm PO
    await purchaseOrderService.confirm(
      order.id,
      COMPANY_ID,
      'test-user-id'
    );

    // 3. Receive Goods (Delivery)
    await purchaseOrderService.receive(order.id, COMPANY_ID);

    // 4. In COD, we expect to pay immediately.
    // Create and Post Bill
    const bill = await billService.createFromPurchaseOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        businessDate: new Date(),
        supplierInvoiceNumber: `INV-COD-${Date.now()}`,
      }
    );

    await billService.post(
      bill.id,
      COMPANY_ID,
      new Date(),
      'test-user-id'
    );

    // 5. Pay Bill immediately
    const payment = await paymentService.create(COMPANY_ID, {
      invoiceId: bill.id,
      method: 'CASH',
      amount: 500000,
      businessDate: new Date(),
    });

    expect(payment.id).toBeDefined();

    const paidBill = await billService.getById(bill.id, COMPANY_ID);
    expect(paidBill?.status).toBe(InvoiceStatus.PAID);
  });
});
