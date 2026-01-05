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
 * P2P Edge Case Tests (tRPC Layer)
 *
 * Mirrors the service-layer integration tests but uses the tRPC router directly.
 */

const COMPANY_ID = 'test-trpc-edge-cases-001';
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
  userPermissions: ['*:*'], // full permissions for test purposes
  idempotencyKey: undefined,
});

describe('P2P Edge Cases (tRPC): Comprehensive Error Handling', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Test tRPC Edge Cases Company',
      },
      update: {},
    });

    // Setup Required Accounts
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

    // Setup Partner (Supplier)
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test tRPC Edge Supplier',
        type: 'SUPPLIER',
        email: `trpc-edge-supplier-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `TRPC-EDGE-PROD-${Date.now()}`,
        name: 'tRPC Edge Case Product',
        price: 100000,
        averageCost: 0,
        stockQty: 0,
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

  // =========================================
  // 1. PO Validation Edge Cases
  // =========================================
  describe('1. PO Validation Edge Cases', () => {
    // TODO: Backend validation needed
    it.skip('should reject PO with zero quantity', async () => {
      await expect(
        caller.purchaseOrder.create({
          partnerId,
          type: 'PURCHASE',
          paymentTerms: PaymentTerms.NET30,
          items: [{ productId, quantity: 0, price: 100000 }],
        })
      ).rejects.toThrow();
    });

    // TODO: Backend validation needed
    it.skip('should reject PO with negative price', async () => {
      await expect(
        caller.purchaseOrder.create({
          partnerId,
          type: 'PURCHASE',
          paymentTerms: PaymentTerms.NET30,
          items: [{ productId, quantity: 10, price: -100 }],
        })
      ).rejects.toThrow();
    });

    // TODO: Backend validation needed
    it.skip('should reject PO with empty items', async () => {
      await expect(
        caller.purchaseOrder.create({
          partnerId,
          type: 'PURCHASE',
          paymentTerms: PaymentTerms.NET30,
          items: [],
        })
      ).rejects.toThrow();
    });

    it('should reject confirming DRAFT PO twice', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      await expect(
        caller.purchaseOrder.confirm({ id: order.id })
      ).rejects.toThrow();
    });
  });

  // =========================================
  // 2. GRN / Receiving Edge Cases
  // =========================================
  describe('2. GRN / Receiving Edge Cases', () => {
    it('should prevent receiving against DRAFT PO', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await expect(
        caller.inventory.createGRN({
          purchaseOrderId: order.id,
          items: [{ productId, quantity: 10 }],
        })
      ).rejects.toThrow(/confirmed|status/i);
    });

    it('should prevent over-receiving (qty > PO qty)', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      await expect(
        caller.inventory.createGRN({
          purchaseOrderId: order.id,
          items: [{ productId, quantity: 10 }],
        })
      ).rejects.toThrow(/exceed|remaining/i);
    });

    it('should prevent cumulative over-receiving', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 11, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      // First GRN 6
      await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 6 }],
      });
      // Second GRN 5 (total 11) - should be allowed
      await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      // Third GRN 1 (total 12) - should fail
      await expect(
        caller.inventory.createGRN({
          purchaseOrderId: order.id,
          items: [{ productId, quantity: 1 }],
        })
      ).rejects.toThrow();
    });

    it('should allow exact remaining quantity', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      // First GRN 6
      await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 6 }],
      });
      // Remaining 4 should be allowed
      await expect(
        caller.inventory.createGRN({
          purchaseOrderId: order.id,
          items: [{ productId, quantity: 4 }],
        })
      ).resolves.toBeDefined();
    });

    it('should prevent posting GRN twice', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await caller.inventory.postGRN({ id: grn.id });
      await expect(
        caller.inventory.postGRN({ id: grn.id })
      ).rejects.toThrow();
    });
  });

  // =========================================
  // 3. Bill Edge Cases
  // =========================================
  describe('3. Bill Edge Cases', () => {
    it('should prevent creating Bill without GRN', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      await expect(
        caller.bill.createFromPO({ orderId: order.id })
      ).rejects.toThrow(/goods.*received/i);
    });

    it('should prevent duplicate Bill for same GRN', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await caller.inventory.postGRN({ id: grn.id });
      // First Bill
      await caller.bill.createFromPO({
        orderId: order.id,
        fulfillmentId: grn.id,
      });
      // Second Bill should fail
      await expect(
        caller.bill.createFromPO({
          orderId: order.id,
          fulfillmentId: grn.id,
        })
      ).rejects.toThrow(/already.*bill|bill.*linked/i);
    });

    it('should prevent posting Bill twice', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await caller.inventory.postGRN({ id: grn.id });
      const bill = await caller.bill.createFromPO({
        orderId: order.id,
        fulfillmentId: grn.id,
      });
      await caller.bill.post({ id: bill.id });
      await expect(
        caller.bill.post({ id: bill.id })
      ).rejects.toThrow();
    });
  });

  // =========================================
  // 4. Payment Edge Cases
  // =========================================
  describe('4. Payment Edge Cases', () => {
    it('should prevent payment on DRAFT Bill', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await caller.inventory.postGRN({ id: grn.id });
      const bill = await caller.bill.createFromPO({
        orderId: order.id,
        fulfillmentId: grn.id,
      });
      await expect(
        caller.payment.create({
          invoiceId: bill.id,
          amount: 500000,
          method: 'CASH',
        })
      ).rejects.toThrow(/DRAFT|must be POSTED/i);
    });

    it('should prevent overpayment', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await caller.inventory.postGRN({ id: grn.id });
      const bill = await caller.bill.createFromPO({
        orderId: order.id,
        fulfillmentId: grn.id,
      });
      await caller.bill.post({ id: bill.id });
      await expect(
        caller.payment.create({
          invoiceId: bill.id,
          amount: 1000000,
          method: 'CASH',
        })
      ).rejects.toThrow(/exceed/i);
    });

    it('should prevent zero amount payment', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await caller.inventory.postGRN({ id: grn.id });
      const bill = await caller.bill.createFromPO({
        orderId: order.id,
        fulfillmentId: grn.id,
      });
      await caller.bill.post({ id: bill.id });
      await expect(
        caller.payment.create({
          invoiceId: bill.id,
          amount: 0,
          method: 'CASH',
        })
      ).rejects.toThrow();
    });

    it('should prevent negative payment', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await caller.inventory.postGRN({ id: grn.id });
      const bill = await caller.bill.createFromPO({
        orderId: order.id,
        fulfillmentId: grn.id,
      });
      await caller.bill.post({ id: bill.id });
      await expect(
        caller.payment.create({
          invoiceId: bill.id,
          amount: -10000,
          method: 'CASH',
        })
      ).rejects.toThrow();
    });
  });

  // =========================================
  // 5. DP Edge Cases
  // =========================================
  describe('5. DP Edge Cases', () => {
    it('should block GRN for UPFRONT PO without paid DP', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.UPFRONT,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      await expect(
        caller.inventory.createGRN({
          purchaseOrderId: order.id,
          items: [{ productId, quantity: 5 }],
        })
      ).rejects.toThrow(/DP Bill|upfront|confirm/i);
    });

    it('should prevent DP Bill on NET30 PO without dpAmount', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        dpPercent: 0,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      await expect(
        caller.bill.createDpBill({ orderId: order.id })
      ).rejects.toThrow(/UPFRONT|dpAmount/i);
    });

    it('should ensure DP Bill amount equals DP percent of total', async () => {
      const dpPercent = 25;
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        dpPercent,
        items: [{ productId, quantity: 10, price: 100000 }], // total 1,000,000
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const dpBill = await caller.bill.createDpBill({
        orderId: order.id,
      });
      expect(Number(dpBill.amount)).toBe(250000);
    });
  });

  // =========================================
  // 6. Void Edge Cases
  // =========================================
  describe('6. Void Edge Cases', () => {
    it('should prevent voiding DRAFT Bill', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await caller.inventory.postGRN({ id: grn.id });
      const bill = await caller.bill.createFromPO({
        orderId: order.id,
      });
      await expect(
        caller.bill.void({ id: bill.id, reason: 'Test void' })
      ).rejects.toThrow();
    });

    it('should prevent voiding GRN with linked Bill', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await caller.inventory.postGRN({ id: grn.id });
      const bill = await caller.bill.createFromPO({
        orderId: order.id,
        fulfillmentId: grn.id,
      });
      await caller.bill.post({ id: bill.id });
      await expect(
        caller.inventory.voidGRN({ id: grn.id, reason: 'Test void' })
      ).rejects.toThrow();
    });
  });

  // =========================================
  // 7. Tax Edge Cases
  // =========================================
  describe('7. Tax Edge Cases', () => {
    it('should correctly calculate tax on Bill', async () => {
      const taxRate = 11;
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        taxRate,
        items: [{ productId, quantity: 10, price: 100000 }], // subtotal 1,000,000
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 10 }],
      });
      await caller.inventory.postGRN({ id: grn.id });
      const bill = await caller.bill.createFromPO({
        orderId: order.id,
        taxRate,
      });
      expect(Number(bill.subtotal)).toBe(1000000);
      expect(Number(bill.taxAmount)).toBe(110000);
      expect(Number(bill.amount)).toBe(1110000);
    });

    it('should handle zero tax rate', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        taxRate: 0,
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
      });
      expect(Number(bill.subtotal)).toBe(1000000);
      expect(Number(bill.taxAmount)).toBe(0);
      expect(Number(bill.amount)).toBe(1000000);
    });
  });

  // =========================================
  // 8. Status Transition Edge Cases
  // =========================================
  describe('8. Status Transition Edge Cases', () => {
    it('should update Bill to PARTIALLY_PAID on partial payment', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
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
        method: 'CASH',
      });
      const updated = await caller.bill.getById({ id: bill.id });
      expect(updated?.status).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect(Number(updated?.balance)).toBe(900000);
    });

    it('should update Bill to PAID when fully paid', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await caller.inventory.postGRN({ id: grn.id });
      const bill = await caller.bill.createFromPO({
        orderId: order.id,
        fulfillmentId: grn.id,
      });
      await caller.bill.post({ id: bill.id });
      await caller.payment.create({
        invoiceId: bill.id,
        amount: 500000,
        method: 'CASH',
      });
      const updated = await caller.bill.getById({ id: bill.id });
      expect(updated?.status).toBe(InvoiceStatus.PAID);
      expect(Number(updated?.balance)).toBe(0);
    });

    it('should update PO to PARTIALLY_RECEIVED after partial GRN', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await caller.inventory.postGRN({ id: grn.id });
      const po = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(po?.status).toBe(OrderStatus.PARTIALLY_RECEIVED);
    });

    it('should update PO to RECEIVED after full GRN', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 10 }],
      });
      await caller.inventory.postGRN({ id: grn.id });
      const po = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(po?.status).toBe(OrderStatus.RECEIVED);
    });
  });

  // =========================================
  // 9. Inventory Edge Cases
  // =========================================
  describe('9. Inventory Edge Cases', () => {
    it('should correctly update stock on GRN post', async () => {
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      const startStock = product?.stockQty || 0;
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 7, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 7 }],
      });
      await caller.inventory.postGRN({ id: grn.id });
      const after = await prisma.product.findUnique({
        where: { id: productId },
      });
      expect(after?.stockQty).toBe(startStock + 7);
    });

    it('should correctly calculate average cost', async () => {
      const testProduct = await prisma.product.create({
        data: {
          companyId: COMPANY_ID,
          sku: `AVG-COST-${Date.now()}`,
          name: 'Average Cost Test Product',
          price: 100000,
          averageCost: 0,
          stockQty: 0,
        },
      });
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [
          { productId: testProduct.id, quantity: 10, price: 50000 },
        ],
      });
      await caller.purchaseOrder.confirm({ id: order.id });
      const grn = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId: testProduct.id, quantity: 10 }],
      });
      await caller.inventory.postGRN({ id: grn.id });
      const updated = await prisma.product.findUnique({
        where: { id: testProduct.id },
      });
      expect(Number(updated?.averageCost)).toBe(50000);
    });
  });
});
