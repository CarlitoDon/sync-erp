import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  InvoiceStatus,
  BusinessShape,
  PaymentMethodType,
  AccountType,
} from '@sync-erp/database';
import { appRouter } from '@src/trpc/router';

/**
 * P2P Partial Actions Edge Case Tests (tRPC Layer)
 *
 * Specifically focuses on edge cases in:
 * - Partial GRN sequences
 * - Partial Billing & Re-billing
 * - Partial Payment voids & reversals
 * - Partial DP Allocation capping
 */

const COMPANY_ID = 'test-partial-edge-cases-001';
const USER_ID = 'test-user-001';

const caller = appRouter.createCaller({
  req: undefined as any,
  res: undefined as any,
  userId: USER_ID,
  companyId: COMPANY_ID,
  businessShape: BusinessShape.RETAIL,
  correlationId: 'test-correlation',
  userRole: 'ADMIN' as any,
  userPermissions: ['*:*'],
  idempotencyKey: undefined,
});

describe('P2P Partial Actions Edge Cases (tRPC)', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Test Partial Edge Cases Company',
      },
      update: {},
    });

    const accounts = [
      { code: '1100', name: 'Cash', type: AccountType.ASSET },
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
        name: 'Partial Edge Case Supplier',
        type: 'SUPPLIER',
        email: `partial-edge-supplier-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `PARTIAL-EDGE-${Date.now()}`,
        name: 'Partial Edge product',
        price: 100000,
        averageCost: 0,
        stockQty: 0,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup - Correct order to satisfy FK constraints
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

  describe('1. Partial Payment & Void Sequence', () => {
    it('should correctly reverse balance and status when partial payments are voided', async () => {
      // 1. Setup Bill
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        items: [{ productId, quantity: 10, price: 100000 }], // 1,000,000
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
      await caller.bill.post({ id: bill.id });

      // 2. Pay Part 1 (Rp 200,000)
      const pay1 = await caller.payment.create({
        invoiceId: bill.id,
        amount: 200000,
        method: PaymentMethodType.CASH,
        businessDate: new Date(),
      });

      // 3. Pay Part 2 (Rp 300,000)
      const pay2 = await caller.payment.create({
        invoiceId: bill.id,
        amount: 300000,
        method: PaymentMethodType.CASH,
        businessDate: new Date(),
      });

      let updatedBill = await caller.bill.getById({ id: bill.id });
      expect(Number(updatedBill?.balance)).toBe(500000);
      expect(updatedBill?.status).toBe(InvoiceStatus.PARTIALLY_PAID);

      // 4. Void Pay 1
      await caller.payment.void({
        id: pay1.id,
        reason: 'Correction',
      });
      updatedBill = await caller.bill.getById({ id: bill.id });
      expect(Number(updatedBill?.balance)).toBe(700000); // Reversed Rp 200k
      expect(updatedBill?.status).toBe(InvoiceStatus.PARTIALLY_PAID);

      // 5. Void Pay 2
      await caller.payment.void({
        id: pay2.id,
        reason: 'Correction',
      });
      updatedBill = await caller.bill.getById({ id: bill.id });
      expect(Number(updatedBill?.balance)).toBe(1000000); // Fully reversed

      // Status should return to POSTED
      expect(updatedBill?.status).toBe(InvoiceStatus.POSTED);
    });
  });

  describe('2. Partial GRN & Deletion Logic', () => {
    it('should restore remaining PO quantity when a draft partial GRN is deleted', async () => {
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await caller.purchaseOrder.confirm({ id: order.id });

      // Receive 6 (Posted)
      const grn1 = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 6 }],
      });
      await caller.inventory.postGRN({ id: grn1.id });

      // Try to create GRN for 5 (total 11) - expect fail
      await expect(
        caller.inventory.createGRN({
          purchaseOrderId: order.id,
          items: [{ productId, quantity: 5 }],
        })
      ).rejects.toThrow();

      // Create Draft GRN for 4 (total 10) - should work
      const grnDraft = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 4 }],
      });

      // While GRN draft exists, try to create another for 1 - expect fail (reservation)
      await expect(
        caller.inventory.createGRN({
          purchaseOrderId: order.id,
          items: [{ productId, quantity: 1 }],
        })
      ).rejects.toThrow();

      // Delete Draft GRN
      await caller.inventory.deleteGRN({ id: grnDraft.id });

      // Now should be able to create GRN for 4 again
      await expect(
        caller.inventory.createGRN({
          purchaseOrderId: order.id,
          items: [{ productId, quantity: 4 }],
        })
      ).resolves.toBeDefined();
    });
  });

  describe('3. Partial DP Allocation & Capping', () => {
    it('should cap DP deduction across multiple partial bills', async () => {
      const dpPercent = 50; // Rp 500,000 DP
      const order = await caller.purchaseOrder.create({
        partnerId,
        type: 'PURCHASE',
        dpPercent,
        items: [{ productId, quantity: 10, price: 100000 }], // total 1,000,000
      });
      await caller.purchaseOrder.confirm({ id: order.id });

      // Pay DP
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

      // Partial GRN 1: 4 units (Gross 400,000)
      const grn1 = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 4 }],
      });
      await caller.inventory.postGRN({ id: grn1.id });

      // Partial Bill 1 for GRN 1
      // DP Deduction: (400,000 / 1,000,000) * 500,000 = 200,000
      // Net Bill: 400,000 - 200,000 = 200,000
      const bill1 = await caller.bill.createFromPO({
        orderId: order.id,
        fulfillmentId: grn1.id,
      });
      expect(Number(bill1.amount)).toBe(200000);
      await caller.bill.post({ id: bill1.id });

      // Partial GRN 2: 6 units (Gross 600,000)
      const grn2 = await caller.inventory.createGRN({
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 6 }],
      });
      await caller.inventory.postGRN({ id: grn2.id });

      // Partial Bill 2 for GRN 2
      // DP Deduction: (600,000 / 1,000,000) * 500,000 = 300,000
      // Net Bill: 600,000 - 300,000 = 300,000
      const bill2 = await caller.bill.createFromPO({
        orderId: order.id,
        fulfillmentId: grn2.id,
      });
      expect(Number(bill2.amount)).toBe(300000);
      await caller.bill.post({ id: bill2.id });

      // Check total DP deducted
      const bills = await prisma.invoice.findMany({
        where: {
          orderId: order.id,
          type: 'BILL',
          isDownPayment: false,
          status: { not: InvoiceStatus.VOID },
        },
      });
      const totalDeducted = bills.reduce((sum, b) => {
        // dpDeducted = Gross - Net. Gross = Subtotal * (1 + tax). Here tax = 0
        const dpDeducted = Number(b.subtotal) - Number(b.amount);
        return sum + dpDeducted;
      }, 0);
      expect(totalDeducted).toBe(500000);
    });
  });
});
