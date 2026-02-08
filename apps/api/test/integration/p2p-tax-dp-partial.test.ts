import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  OrderStatus,
  InvoiceStatus,
  PaymentTerms,
} from '@sync-erp/database';
import { BillService } from '@modules/accounting/services/bill.service';
import { PaymentService } from '@modules/accounting/services/payment.service';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';
import { InventoryService } from '@modules/inventory/inventory.service';

/**
 * Comprehensive P2P E2E Test: Tax + DP + Partial GRN + Per-GRN Billing + Partial Payments
 *
 * Flow:
 * 1. Create PO with Tax (11%) and DP (30%)
 * 2. Create and Pay DP Bill
 * 3. Receive goods partially (GRN 1: 50%, GRN 2: 50%)
 * 4. Create Bill per GRN with proportional DP deduction
 * 5. Pay Bills partially until fully paid
 * 6. Verify order status = COMPLETED
 */

const billService = new BillService();
const paymentService = new PaymentService();
const procurementService = new PurchaseOrderService();
const inventoryService = new InventoryService();

const COMPANY_ID = 'test-p2p-tax-dp-partial-001';
const ACTOR_ID = 'test-user-001';

describe('P2P E2E: Tax + DP + Partial GRN + Per-GRN Billing', () => {
  let productA: { id: string };
  let productB: { id: string };
  let partnerId: string;
  let orderId: string;
  let dpBillId: string;
  let grn1Id: string;
  let grn2Id: string;
  let bill1Id: string;
  let bill2Id: string;

  // Test data
  const TAX_RATE = 11; // 11%
  const DP_PERCENT = 30; // 30%
  const PRODUCT_A_PRICE = 3200000; // Ergo Chair
  const PRODUCT_B_PRICE = 15000000; // Laptop Pro
  const PRODUCT_A_QTY = 10;
  const PRODUCT_B_QTY = 20;

  // Calculated values
  const SUBTOTAL =
    PRODUCT_A_PRICE * PRODUCT_A_QTY + PRODUCT_B_PRICE * PRODUCT_B_QTY;
  // = 32,000,000 + 300,000,000 = 332,000,000
  const TAX_AMOUNT = SUBTOTAL * (TAX_RATE / 100);
  // = 332,000,000 * 0.11 = 36,520,000
  const TOTAL_AMOUNT = SUBTOTAL + TAX_AMOUNT;
  // = 332,000,000 + 36,520,000 = 368,520,000
  const DP_AMOUNT = TOTAL_AMOUNT * (DP_PERCENT / 100);
  // = 368,520,000 * 0.30 = 110,556,000

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Test P2P Tax DP Partial Company',
      },
      update: {},
    });

    // 2. Setup Required Accounts (must include all accounts used by JournalService)
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '1500', name: 'VAT Receivable', type: 'ASSET' },
      { code: '1550', name: 'Supplier Prepayment', type: 'ASSET' },
      { code: '1600', name: 'DP Prepayment Asset', type: 'ASSET' }, // For DP Bill posting
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
        name: 'Test Supplier Tax DP',
        type: 'SUPPLIER',
        email: `supplier-tax-dp-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // 4. Setup Products
    productA = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `CHAIR-${Date.now()}`,
        name: 'Ergo Chair',
        price: PRODUCT_A_PRICE,
        averageCost: 0,
        stockQty: 0,
      },
    });

    productB = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `LAPTOP-${Date.now()}`,
        name: 'Laptop Pro X1',
        price: PRODUCT_B_PRICE,
        averageCost: 0,
        stockQty: 0,
      },
    });
  });

  afterAll(async () => {
    // Cleanup in proper order
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

  describe('Step 1: Create PO with Tax and DP', () => {
    it('should create PO with 11% tax and 30% DP', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        taxRate: TAX_RATE,
        dpPercent: DP_PERCENT,
        items: [
          {
            productId: productA.id,
            quantity: PRODUCT_A_QTY,
            price: PRODUCT_A_PRICE,
          },
          {
            productId: productB.id,
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
      expect(Number(order.dpAmount)).toBeCloseTo(DP_AMOUNT, 0);
    });

    it('should confirm the PO', async () => {
      const confirmed = await procurementService.confirm(
        orderId,
        COMPANY_ID,
        ACTOR_ID
      );
      expect(confirmed.status).toBe(OrderStatus.CONFIRMED);
    });
  });

  describe('Step 2: Create and Pay DP Bill', () => {
    it('should create DP Bill', async () => {
      const dpBill = await billService.createDownPaymentBill(
        COMPANY_ID,
        orderId
      );
      dpBillId = dpBill.id;

      expect(dpBill.isDownPayment).toBe(true);
      expect(dpBill.status).toBe(InvoiceStatus.DRAFT);
      // DP Bill amount should be 30% of PO total
      expect(Number(dpBill.amount)).toBeCloseTo(DP_AMOUNT, 0);
    });

    it('should post DP Bill', async () => {
      const posted = await billService.post(
        dpBillId,
        COMPANY_ID,
        undefined,
        ACTOR_ID
      );
      expect(posted.status).toBe(InvoiceStatus.POSTED);
    });

    it('should pay DP Bill in full', async () => {
      const payment = await paymentService.create(COMPANY_ID, {
        invoiceId: dpBillId,
        amount: DP_AMOUNT,
        method: 'BANK',
      });

      expect(Number(payment.amount)).toBeCloseTo(DP_AMOUNT, 0);

      const paidBill = await billService.getById(
        dpBillId,
        COMPANY_ID
      );
      expect(paidBill?.status).toBe(InvoiceStatus.PAID);
      expect(Number(paidBill?.balance)).toBe(0);
    });
  });

  describe('Step 3: Partial GRN (50% each)', () => {
    it('should create and post GRN 1 (50% of each product)', async () => {
      const grn1 = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: orderId,
        notes: 'First partial shipment - 50%',
        items: [
          { productId: productA.id, quantity: PRODUCT_A_QTY / 2 }, // 5 chairs
          { productId: productB.id, quantity: PRODUCT_B_QTY / 2 }, // 10 laptops
        ],
      });
      grn1Id = grn1.id;
      expect(grn1.status).toBe('DRAFT');

      const posted = await inventoryService.postGRN(
        COMPANY_ID,
        grn1.id,
        undefined,
        ACTOR_ID
      );
      expect(posted.status).toBe('POSTED');

      // Verify stock updated
      const pA = await prisma.product.findUnique({
        where: { id: productA.id },
      });
      const pB = await prisma.product.findUnique({
        where: { id: productB.id },
      });
      expect(pA?.stockQty).toBe(5);
      expect(pB?.stockQty).toBe(10);
    });

    it('should update PO status to PARTIALLY_RECEIVED', async () => {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });
      expect(order?.status).toBe(OrderStatus.PARTIALLY_RECEIVED);
    });

    it('should create and post GRN 2 (remaining 50%)', async () => {
      const grn2 = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: orderId,
        notes: 'Second partial shipment - remaining 50%',
        items: [
          { productId: productA.id, quantity: PRODUCT_A_QTY / 2 }, // 5 chairs
          { productId: productB.id, quantity: PRODUCT_B_QTY / 2 }, // 10 laptops
        ],
      });
      grn2Id = grn2.id;

      const posted = await inventoryService.postGRN(
        COMPANY_ID,
        grn2.id,
        undefined,
        ACTOR_ID
      );
      expect(posted.status).toBe('POSTED');

      // Verify full stock
      const pA = await prisma.product.findUnique({
        where: { id: productA.id },
      });
      const pB = await prisma.product.findUnique({
        where: { id: productB.id },
      });
      expect(pA?.stockQty).toBe(10);
      expect(pB?.stockQty).toBe(20);
    });

    it('should update PO status to RECEIVED', async () => {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });
      expect(order?.status).toBe(OrderStatus.RECEIVED);
    });
  });

  describe('Step 4: Create Bills per GRN with Proportional DP Deduction', () => {
    it('should create Bill 1 for GRN 1 with proportional DP deduction', async () => {
      const bill1 = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId,
          fulfillmentId: grn1Id,
          taxRate: TAX_RATE,
        }
      );
      bill1Id = bill1.id;

      expect(bill1.fulfillmentId).toBe(grn1Id);
      expect(bill1.dpBillId).toBe(dpBillId);

      // GRN 1 items: 5 chairs @ 3.2M + 10 laptops @ 15M = 16M + 150M = 166M
      const grn1Subtotal =
        (PRODUCT_A_QTY / 2) * PRODUCT_A_PRICE +
        (PRODUCT_B_QTY / 2) * PRODUCT_B_PRICE;
      const grn1Tax = grn1Subtotal * (TAX_RATE / 100);
      const grn1Gross = grn1Subtotal + grn1Tax;

      expect(Number(bill1.subtotal)).toBeCloseTo(grn1Subtotal, 0);
      expect(Number(bill1.taxAmount)).toBeCloseTo(grn1Tax, 0);

      // Proportional DP: (grn1Gross / totalAmount) * dpAmount
      const proportionalDp = (grn1Gross / TOTAL_AMOUNT) * DP_AMOUNT;
      const expectedAmount = grn1Gross - proportionalDp;

      expect(Number(bill1.amount)).toBeCloseTo(expectedAmount, -3); // Allow 1000 rounding
      expect(Number(bill1.amount)).toBeGreaterThan(0); // NOT zero!
    });

    it('should create Bill 2 for GRN 2 with remaining DP deduction', async () => {
      const bill2 = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId,
          fulfillmentId: grn2Id,
          taxRate: TAX_RATE,
        }
      );
      bill2Id = bill2.id;

      expect(bill2.fulfillmentId).toBe(grn2Id);
      expect(bill2.dpBillId).toBe(dpBillId);

      // GRN 2 is same as GRN 1 (50% each)
      const grn2Subtotal =
        (PRODUCT_A_QTY / 2) * PRODUCT_A_PRICE +
        (PRODUCT_B_QTY / 2) * PRODUCT_B_PRICE;
      const grn2Tax = grn2Subtotal * (TAX_RATE / 100);
      void grn2Tax; // For potential future use

      expect(Number(bill2.subtotal)).toBeCloseTo(grn2Subtotal, 0);
      expect(Number(bill2.amount)).toBeGreaterThan(0); // NOT zero!
    });

    it('should verify total Bills + DP = PO Total', async () => {
      const bill1 = await billService.getById(bill1Id, COMPANY_ID);
      const bill2 = await billService.getById(bill2Id, COMPANY_ID);

      const totalBilled =
        Number(bill1?.subtotal) +
        Number(bill1?.taxAmount) +
        Number(bill2?.subtotal) +
        Number(bill2?.taxAmount);

      // Total bills (gross) should equal PO total
      expect(totalBilled).toBeCloseTo(TOTAL_AMOUNT, -2);

      // Net payable (after DP) should be PO total - DP
      const netPayable =
        Number(bill1?.amount) + Number(bill2?.amount);
      expect(netPayable).toBeCloseTo(TOTAL_AMOUNT - DP_AMOUNT, -3);
    });
  });

  describe('Step 5: Post Bills and Make Partial Payments', () => {
    it('should post Bill 1', async () => {
      const posted = await billService.post(
        bill1Id,
        COMPANY_ID,
        undefined,
        ACTOR_ID
      );
      expect(posted.status).toBe(InvoiceStatus.POSTED);
    });

    it('should post Bill 2', async () => {
      const posted = await billService.post(
        bill2Id,
        COMPANY_ID,
        undefined,
        ACTOR_ID
      );
      expect(posted.status).toBe(InvoiceStatus.POSTED);
    });

    it('should make partial payment on Bill 1 (50%)', async () => {
      const bill1 = await billService.getById(bill1Id, COMPANY_ID);
      const partialAmount = Number(bill1?.balance) / 2;

      const payment = await paymentService.create(COMPANY_ID, {
        invoiceId: bill1Id,
        amount: partialAmount,
        method: 'BANK',
      });

      expect(Number(payment.amount)).toBeCloseTo(partialAmount, 0);

      const updated = await billService.getById(bill1Id, COMPANY_ID);
      expect(updated?.status).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect(Number(updated?.balance)).toBeCloseTo(partialAmount, 0);
    });

    it('should pay remaining Bill 1 balance', async () => {
      const bill1 = await billService.getById(bill1Id, COMPANY_ID);
      const remaining = Number(bill1?.balance);

      await paymentService.create(COMPANY_ID, {
        invoiceId: bill1Id,
        amount: remaining,
        method: 'CASH',
      });

      const updated = await billService.getById(bill1Id, COMPANY_ID);
      expect(updated?.status).toBe(InvoiceStatus.PAID);
      expect(Number(updated?.balance)).toBe(0);
    });

    it('should pay Bill 2 in full', async () => {
      const bill2 = await billService.getById(bill2Id, COMPANY_ID);
      const amount = Number(bill2?.balance);

      await paymentService.create(COMPANY_ID, {
        invoiceId: bill2Id,
        amount,
        method: 'BANK',
      });

      const updated = await billService.getById(bill2Id, COMPANY_ID);
      expect(updated?.status).toBe(InvoiceStatus.PAID);
      expect(Number(updated?.balance)).toBe(0);
    });
  });

  describe('Step 6: Verify Final State', () => {
    it('should have all Bills PAID', async () => {
      const dpBill = await billService.getById(dpBillId, COMPANY_ID);
      const bill1 = await billService.getById(bill1Id, COMPANY_ID);
      const bill2 = await billService.getById(bill2Id, COMPANY_ID);

      expect(dpBill?.status).toBe(InvoiceStatus.PAID);
      expect(bill1?.status).toBe(InvoiceStatus.PAID);
      expect(bill2?.status).toBe(InvoiceStatus.PAID);
    });

    it('should have PO status COMPLETED (fully received and paid)', async () => {
      // PO status is COMPLETED when all goods are received AND all bills are paid
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });
      expect(order?.status).toBe(OrderStatus.COMPLETED);
    });

    it('should have correct inventory quantities', async () => {
      const pA = await prisma.product.findUnique({
        where: { id: productA.id },
      });
      const pB = await prisma.product.findUnique({
        where: { id: productB.id },
      });

      expect(pA?.stockQty).toBe(PRODUCT_A_QTY); // 10 chairs
      expect(pB?.stockQty).toBe(PRODUCT_B_QTY); // 20 laptops
    });

    it('should have correct average costs', async () => {
      const pA = await prisma.product.findUnique({
        where: { id: productA.id },
      });
      const pB = await prisma.product.findUnique({
        where: { id: productB.id },
      });

      expect(Number(pA?.averageCost)).toBe(PRODUCT_A_PRICE);
      expect(Number(pB?.averageCost)).toBe(PRODUCT_B_PRICE);
    });
  });
});
