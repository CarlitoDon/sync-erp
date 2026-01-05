import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  OrderStatus,
  InvoiceStatus,
  PaymentTerms,
  BusinessShape,
} from '@sync-erp/database';
import { appRouter } from '@src/trpc/router';

/**
 * Comprehensive P2P E2E Test using tRPC Caller (tests full tRPC layer)
 *
 * This version uses appRouter.createCaller() to test tRPC procedures directly,
 * including input validation and middleware, without HTTP complexity.
 *
 * Flow:
 * 1. Create PO with Tax (11%) and DP (30%)
 * 2. Create and Pay DP Bill
 * 3. Receive goods partially (GRN 1: 50%, GRN 2: 50%)
 * 4. Create Bill per GRN with proportional DP deduction
 * 5. Pay Bills partially until fully paid
 * 6. Verify order status = COMPLETED
 */

const COMPANY_ID = 'test-trpc-caller-p2p-001';
const USER_ID = 'test-user-001';

// Create tRPC caller with test context
const caller = appRouter.createCaller({
  req: undefined as any,
  res: undefined as any,
  userId: USER_ID,
  companyId: COMPANY_ID,
  businessShape: BusinessShape.RETAIL,
  correlationId: 'test-correlation',
  userRole: 'ADMIN' as any,
  userPermissions: [],
  idempotencyKey: undefined,
});

describe('P2P E2E (tRPC Caller): Tax + DP + Partial GRN + Per-GRN Billing', () => {
  let productAId: string;
  let productBId: string;
  let partnerId: string;
  let orderId: string;
  let dpBillId: string;
  let grn1Id: string;
  let grn2Id: string;
  let bill1Id: string;
  let bill2Id: string;

  // Test data
  const TAX_RATE = 11;
  const DP_PERCENT = 30;
  const PRODUCT_A_PRICE = 3200000;
  const PRODUCT_B_PRICE = 15000000;
  const PRODUCT_A_QTY = 10;
  const PRODUCT_B_QTY = 20;

  // Calculated values
  const SUBTOTAL =
    PRODUCT_A_PRICE * PRODUCT_A_QTY + PRODUCT_B_PRICE * PRODUCT_B_QTY;
  const TAX_AMOUNT = SUBTOTAL * (TAX_RATE / 100);
  const TOTAL_AMOUNT = SUBTOTAL + TAX_AMOUNT;
  const DP_AMOUNT = TOTAL_AMOUNT * (DP_PERCENT / 100);

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Test tRPC Caller P2P Company',
      },
      update: {},
    });

    // 2. Setup Required Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '1500', name: 'VAT Receivable', type: 'ASSET' },
      { code: '1550', name: 'Supplier Prepayment', type: 'ASSET' },
      { code: '1600', name: 'DP Prepayment Asset', type: 'ASSET' },
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

    // 3. Setup Partner (Supplier)
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test tRPC Caller Supplier',
        type: 'SUPPLIER',
        email: `trpc-caller-supplier-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // 4. Setup Products
    const productA = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `TRPC-CHAIR-${Date.now()}`,
        name: 'Ergo Chair',
        price: PRODUCT_A_PRICE,
        averageCost: 0,
        stockQty: 0,
      },
    });
    productAId = productA.id;

    const productB = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `TRPC-LAPTOP-${Date.now()}`,
        name: 'Laptop Pro X1',
        price: PRODUCT_B_PRICE,
        averageCost: 0,
        stockQty: 0,
      },
    });
    productBId = productB.id;
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

  describe('Step 1: Create PO with Tax and DP (via tRPC)', () => {
    it('should create PO via purchaseOrder.create', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        taxRate: TAX_RATE,
        dpPercent: DP_PERCENT,
        items: [
          {
            productId: productAId,
            quantity: PRODUCT_A_QTY,
            price: PRODUCT_A_PRICE,
          },
          {
            productId: productBId,
            quantity: PRODUCT_B_QTY,
            price: PRODUCT_B_PRICE,
          },
        ],
      });

      orderId = order.id;
      expect(order.status).toBe(OrderStatus.DRAFT);
      expect(Number(order.taxRate)).toBe(TAX_RATE);
      expect(Number(order.dpPercent)).toBe(DP_PERCENT);
      expect(Number(order.totalAmount)).toBeCloseTo(TOTAL_AMOUNT, 0);
    });

    it('should confirm PO via purchaseOrder.confirm', async () => {
      const confirmed = await caller.purchaseOrder.confirm({
        id: orderId,
      });
      expect(confirmed.status).toBe(OrderStatus.CONFIRMED);
    });
  });

  describe('Step 2: Create and Pay DP Bill (via tRPC)', () => {
    it('should create DP Bill via bill.createDpBill', async () => {
      const dpBill = await caller.bill.createDpBill({ orderId });
      dpBillId = dpBill.id;

      expect(dpBill.isDownPayment).toBe(true);
      expect(dpBill.status).toBe(InvoiceStatus.DRAFT);
      expect(Number(dpBill.amount)).toBeCloseTo(DP_AMOUNT, 0);
    });

    it('should post DP Bill via bill.post', async () => {
      const posted = await caller.bill.post({ id: dpBillId });
      expect(posted.status).toBe(InvoiceStatus.POSTED);
    });

    it('should pay DP Bill via payment.create', async () => {
      const payment = await caller.payment.create({
        invoiceId: dpBillId,
        amount: DP_AMOUNT,
        method: 'BANK_TRANSFER',
      });

      expect(Number(payment.amount)).toBeCloseTo(DP_AMOUNT, 0);

      const paidBill = await caller.bill.getById({ id: dpBillId });
      expect(paidBill?.status).toBe(InvoiceStatus.PAID);
    });
  });

  describe('Step 3: Partial GRN (50% each) via tRPC', () => {
    it('should create and post GRN 1', async () => {
      const grn1 = await caller.inventory.createGRN({
        purchaseOrderId: orderId,
        notes: 'First partial shipment - 50%',
        items: [
          { productId: productAId, quantity: PRODUCT_A_QTY / 2 },
          { productId: productBId, quantity: PRODUCT_B_QTY / 2 },
        ],
      });
      grn1Id = grn1.id;
      expect(grn1.status).toBe('DRAFT');

      const posted = await caller.inventory.postGRN({ id: grn1Id });
      expect(posted.status).toBe('POSTED');

      const pA = await prisma.product.findUnique({
        where: { id: productAId },
      });
      const pB = await prisma.product.findUnique({
        where: { id: productBId },
      });
      expect(pA?.stockQty).toBe(5);
      expect(pB?.stockQty).toBe(10);
    });

    it('should have PO status PARTIALLY_RECEIVED', async () => {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });
      expect(order?.status).toBe(OrderStatus.PARTIALLY_RECEIVED);
    });

    it('should create and post GRN 2', async () => {
      const grn2 = await caller.inventory.createGRN({
        purchaseOrderId: orderId,
        notes: 'Second partial shipment - remaining 50%',
        items: [
          { productId: productAId, quantity: PRODUCT_A_QTY / 2 },
          { productId: productBId, quantity: PRODUCT_B_QTY / 2 },
        ],
      });
      grn2Id = grn2.id;

      const posted = await caller.inventory.postGRN({ id: grn2Id });
      expect(posted.status).toBe('POSTED');

      const pA = await prisma.product.findUnique({
        where: { id: productAId },
      });
      const pB = await prisma.product.findUnique({
        where: { id: productBId },
      });
      expect(pA?.stockQty).toBe(10);
      expect(pB?.stockQty).toBe(20);
    });

    it('should have PO status RECEIVED', async () => {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });
      expect(order?.status).toBe(OrderStatus.RECEIVED);
    });
  });

  describe('Step 4: Create Bills per GRN with Proportional DP (via tRPC)', () => {
    it('should create Bill 1 for GRN 1 with proportional DP deduction', async () => {
      const bill1 = await caller.bill.createFromPO({
        orderId,
        fulfillmentId: grn1Id,
        taxRate: TAX_RATE,
      });
      bill1Id = bill1.id;

      expect(bill1.fulfillmentId).toBe(grn1Id);
      expect(bill1.dpBillId).toBe(dpBillId);
      expect(Number(bill1.amount)).toBeGreaterThan(0);
    });

    it('should create Bill 2 for GRN 2', async () => {
      const bill2 = await caller.bill.createFromPO({
        orderId,
        fulfillmentId: grn2Id,
        taxRate: TAX_RATE,
      });
      bill2Id = bill2.id;

      expect(bill2.fulfillmentId).toBe(grn2Id);
      expect(Number(bill2.amount)).toBeGreaterThan(0);
    });

    it('should verify total Bills match PO minus DP', async () => {
      const bill1 = await caller.bill.getById({ id: bill1Id });
      const bill2 = await caller.bill.getById({ id: bill2Id });

      const netPayable =
        Number(bill1?.amount) + Number(bill2?.amount);
      expect(netPayable).toBeCloseTo(TOTAL_AMOUNT - DP_AMOUNT, -3);
    });
  });

  describe('Step 5: Post Bills and Payments (via tRPC)', () => {
    it('should post Bill 1', async () => {
      const posted = await caller.bill.post({ id: bill1Id });
      expect(posted.status).toBe(InvoiceStatus.POSTED);
    });

    it('should post Bill 2', async () => {
      const posted = await caller.bill.post({ id: bill2Id });
      expect(posted.status).toBe(InvoiceStatus.POSTED);
    });

    it('should make partial payment on Bill 1 (50%)', async () => {
      const bill1 = await caller.bill.getById({ id: bill1Id });
      const partialAmount = Number(bill1?.balance) / 2;

      const payment = await caller.payment.create({
        invoiceId: bill1Id,
        amount: partialAmount,
        method: 'BANK_TRANSFER',
      });

      expect(Number(payment.amount)).toBeCloseTo(partialAmount, 0);

      const updated = await caller.bill.getById({ id: bill1Id });
      expect(updated?.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    });

    it('should pay remaining Bill 1 balance', async () => {
      const bill1 = await caller.bill.getById({ id: bill1Id });
      const remaining = Number(bill1?.balance);

      await caller.payment.create({
        invoiceId: bill1Id,
        amount: remaining,
        method: 'CASH',
      });

      const updated = await caller.bill.getById({ id: bill1Id });
      expect(updated?.status).toBe(InvoiceStatus.PAID);
    });

    it('should pay Bill 2 in full', async () => {
      const bill2 = await caller.bill.getById({ id: bill2Id });
      const amount = Number(bill2?.balance);

      await caller.payment.create({
        invoiceId: bill2Id,
        amount,
        method: 'BANK_TRANSFER',
      });

      const updated = await caller.bill.getById({ id: bill2Id });
      expect(updated?.status).toBe(InvoiceStatus.PAID);
    });
  });

  describe('Step 6: Verify Final State', () => {
    it('should have all Bills PAID', async () => {
      const dpBill = await caller.bill.getById({ id: dpBillId });
      const bill1 = await caller.bill.getById({ id: bill1Id });
      const bill2 = await caller.bill.getById({ id: bill2Id });

      expect(dpBill?.status).toBe(InvoiceStatus.PAID);
      expect(bill1?.status).toBe(InvoiceStatus.PAID);
      expect(bill2?.status).toBe(InvoiceStatus.PAID);
    });

    it('should have PO status COMPLETED', async () => {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });
      expect(order?.status).toBe(OrderStatus.COMPLETED);
    });

    it('should have correct inventory quantities', async () => {
      const pA = await prisma.product.findUnique({
        where: { id: productAId },
      });
      const pB = await prisma.product.findUnique({
        where: { id: productBId },
      });

      expect(pA?.stockQty).toBe(PRODUCT_A_QTY);
      expect(pB?.stockQty).toBe(PRODUCT_B_QTY);
    });

    it('should have correct average costs', async () => {
      const pA = await prisma.product.findUnique({
        where: { id: productAId },
      });
      const pB = await prisma.product.findUnique({
        where: { id: productBId },
      });

      expect(Number(pA?.averageCost)).toBe(PRODUCT_A_PRICE);
      expect(Number(pB?.averageCost)).toBe(PRODUCT_B_PRICE);
    });
  });
});
