import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  PaymentTerms,
  BusinessShape,
  PaymentMethodType,
  AccountType,
} from '@sync-erp/database';
import { appRouter } from '@src/trpc/router';

/**
 * P2P More Edge Case Tests (tRPC Layer)
 */

const COMPANY_ID = 'test-more-p2p-edge-cases-001';
const USER_ID = 'test-user-001';

const caller = appRouter.createCaller({
  req: undefined as unknown as import("express").Request,
  res: undefined as unknown as import("express").Response,
  userId: USER_ID,
  companyId: COMPANY_ID,
  businessShape: BusinessShape.RETAIL,
  correlationId: 'test-correlation',
  userRole: "ADMIN" as string,
  userPermissions: ['*:*'],
  idempotencyKey: undefined,
});

describe('P2P More Edge Cases (tRPC)', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Test More P2P Edge Cases Company',
      },
      update: {},
    });

    const accounts = [
      { code: '1100', name: 'Cash', type: AccountType.ASSET },
      { code: '1200', name: 'Bank', type: AccountType.ASSET },
      {
        code: '1400',
        name: 'Inventory Asset',
        type: AccountType.ASSET,
      },
      {
        code: '1500',
        name: 'VAT Receivable',
        type: AccountType.ASSET,
      },
      {
        code: '1600',
        name: 'DP Prepayment Asset',
        type: AccountType.ASSET,
      },
      {
        code: '2100',
        name: 'Accounts Payable',
        type: AccountType.LIABILITY,
      },
      {
        code: '2105',
        name: 'GRNI Accrued',
        type: AccountType.LIABILITY,
      },
      { code: '5000', name: 'COGS', type: AccountType.EXPENSE },
    ];
    for (const acc of accounts) {
      await prisma.account.upsert({
        where: {
          companyId_code: { companyId: COMPANY_ID, code: acc.code },
        },
        update: {},
        create: { ...acc, companyId: COMPANY_ID, isActive: true },
      });
    }

    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'More Edge Case Supplier',
        type: 'SUPPLIER',
        email: `more-edge-supplier-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Default product for general tests
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `MORE-EDGE-${Date.now()}`,
        name: 'More Edge product',
        price: 100000,
        averageCost: 0,
        stockQty: 0,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.journalLine.deleteMany({
      where: { journal: { companyId: COMPANY_ID } },
    });
    await prisma.journalEntry.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.payment.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.invoice.deleteMany({
      where: { companyId: COMPANY_ID },
    });
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

  describe('1. UPFRONT PO: Partial DP payment blocks GRN', () => {
    it('should block GRN if DP is only partially paid on UPFRONT order', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.UPFRONT,
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });

      const dpBill = await caller.bill.createDpBill({
        orderId: order.id,
      });
      await caller.bill.post({ id: dpBill.id });

      await caller.payment.create({
        invoiceId: dpBill.id,
        amount: 500000,
        method: PaymentMethodType.CASH,
        businessDate: new Date(),
      });

      await expect(
        caller.inventory.createGRN({
          purchaseOrderId: order.id,
          items: [{ productId, quantity: 10 }],
        })
      ).rejects.toThrow(/DP Bill|upfront|confirm|paid/i);

      await caller.payment.create({
        invoiceId: dpBill.id,
        amount: 500000,
        method: PaymentMethodType.CASH,
        businessDate: new Date(),
      });

      await expect(
        caller.inventory.createGRN({
          purchaseOrderId: order.id,
          items: [{ productId, quantity: 10 }],
        })
      ).resolves.toBeDefined();
    });
  });

  describe('2. DP Release on Bill Void', () => {
    it('should restore DP availability when a bill with DP deduction is voided', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        dpPercent: 100,
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });

      const dpBill = await caller.bill.createDpBill({
        orderId: order.id,
      });
      await caller.bill.post({ id: dpBill.id });
      await caller.payment.create({
        invoiceId: dpBill.id,
        amount: 1000000,
        method: PaymentMethodType.CASH,
      });

      const grn1 = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await caller.inventory.postGRN({ id: grn1.id });

      const bill1 = await caller.bill.createFromPO({
        orderId: order.id,
        fulfillmentId: grn1.id,
      });
      expect(Number(bill1.amount)).toBe(0);
      await caller.bill.post({ id: bill1.id });

      await caller.bill.void({
        id: bill1.id,
        reason: 'Test release',
      });

      const grn2 = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await caller.inventory.postGRN({ id: grn2.id });

      const bill2 = await caller.bill.createFromPO({
        orderId: order.id,
        fulfillmentId: grn2.id,
      });
      expect(Number(bill2.amount)).toBe(0);
    });
  });

  describe('3. Voiding GRN with PARTIALLY_PAID bill is blocked', () => {
    it('should block voiding GRN if its bill is partially paid', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 10 }],
      });
      await caller.inventory.postGRN({ id: grn.id });
      const bill = await caller.bill.createFromPO({
        orderId: order.id,
        fulfillmentId: grn.id,
      });
      await caller.bill.post({ id: bill.id });

      await caller.payment.create({
        invoiceId: bill.id,
        amount: 100000,
        method: PaymentMethodType.CASH,
      });

      await expect(
        caller.inventory.voidGRN({ id: grn.id, reason: 'Test' })
      ).rejects.toThrow(/Void it first/i);
    });
  });

  describe('4. Multi-PO cross-linking prevention', () => {
    it('should fail if bill for PO-A tries to link to GRN of PO-B', async () => {
      const orderA = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: orderA.id });

      const orderB = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: orderB.id });

      const grnB = await caller.inventory.createGRN({
        purchaseOrderId: orderB.id,
        items: [{ productId, quantity: 10 }],
      });
      await caller.inventory.postGRN({ id: grnB.id });

      await expect(
        caller.bill.createFromPO({
          orderId: orderA.id,
          fulfillmentId: grnB.id,
        })
      ).rejects.toThrow(/received|belong/i);
    });
  });

  describe('5. Purchase Return (tRPC)', () => {
    it('should allow partial purchase return and decrease stock', async () => {
      const returnProd = await prisma.product.create({
        data: {
          companyId: COMPANY_ID,
          sku: `RET-STOCK-${Date.now()}`,
          name: 'Return Stock Product',
          price: 100000,
          averageCost: 0,
          stockQty: 0,
        },
      });

      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        items: [
          { productId: returnProd.id, quantity: 10, price: 100000 },
        ],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId: returnProd.id, quantity: 10 }],
      });
      await caller.inventory.postGRN({ id: grn.id });

      const before = await prisma.product.findUnique({
        where: { id: returnProd.id },
      });
      expect(before?.stockQty).toBe(10);

      await caller.purchaseOrder.returnToPo({
        orderId: order.id,
        items: [{ productId: returnProd.id, quantity: 4 }],
      });

      const after = await prisma.product.findUnique({
        where: { id: returnProd.id },
      });
      expect(after?.stockQty).toBe(6);

      await expect(
        caller.purchaseOrder.returnToPo({
          orderId: order.id,
          items: [{ productId: returnProd.id, quantity: 7 }],
        })
      ).rejects.toThrow(/available/i);
    });
  });

  describe('6. Simultaneous Draft Bills overlap prevention', () => {
    it('should prevent draft bill from exceeding remaining quantity if another draft exists', async () => {
      const order2 = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order2.id });

      const grn2a = await caller.inventory.createGRN({
        purchaseOrderId: order2.id,
        items: [{ productId, quantity: 6 }],
      });
      await caller.inventory.postGRN({ id: grn2a.id });

      const grn2b = await caller.inventory.createGRN({
        purchaseOrderId: order2.id,
        items: [{ productId, quantity: 4 }],
      });
      await caller.inventory.postGRN({ id: grn2b.id });

      await caller.bill.createFromPO({
        orderId: order2.id,
        fulfillmentId: grn2a.id,
      });

      await expect(
        caller.bill.createFromPO({
          orderId: order2.id,
          fulfillmentId: grn2a.id,
        })
      ).rejects.toThrow(/already.*bill/i);
    });
  });
});
