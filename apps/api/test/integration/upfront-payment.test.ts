import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  OrderStatus,
  PaymentTerms,
  PaymentStatus,
  InvoiceStatus,
} from '@sync-erp/database';
import { PurchaseOrderService } from '../../src/modules/procurement/purchase-order.service';

const procurementService = new PurchaseOrderService();

const COMPANY_ID = 'test-upfront-integration-001';
const ACTOR_ID = 'test-user-001';

describe('Feature 036: Cash Upfront Payment (Procurement)', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Test Upfront Payment Company',
      },
      update: {},
    });

    // 2. Setup Required Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '1600', name: 'Advances to Supplier', type: 'ASSET' }, // Feature 036
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
      { code: '2105', name: 'GRNI Accrued', type: 'LIABILITY' },
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
        name: 'Test Upfront Supplier',
        type: 'SUPPLIER',
        email: `upfront-supplier-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // 4. Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `UPFRONT-SKU-${Date.now()}`,
        name: 'Test Upfront Product',
        price: 100000,
        averageCost: 80000,
        stockQty: 0,
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
      prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN (SELECT id FROM "JournalEntry" WHERE "companyId" = ${COMPANY_ID})`,
      prisma.journalEntry.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.payment.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.invoice.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.inventoryMovement.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.goodsReceiptItem.deleteMany({
        where: { goodsReceipt: { companyId: COMPANY_ID } },
      }),
      prisma.goodsReceipt.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.shipmentItem.deleteMany({
        where: { shipment: { companyId: COMPANY_ID } },
      }),
      prisma.shipment.deleteMany({
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

  describe('US1: Create PO with Upfront Terms (T025)', () => {
    it('Should create PO with NET_30 payment terms by default', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: 'NET30',
        items: [{ productId, quantity: 5, price: 100000 }],
      });

      expect(order.status).toBe(OrderStatus.DRAFT);
      expect(order.paymentTerms).toBe(PaymentTerms.NET_30);
      expect(order.paymentStatus).toBeNull();
      expect(Number(order.paidAmount)).toBe(0);
    });

    it('Should create PO with UPFRONT payment terms', async () => {
      const order = await procurementService.create(
        COMPANY_ID,
        {
          partnerId,
          items: [{ productId, quantity: 10, price: 100000 }],
          type: 'PURCHASE',
          paymentTerms: 'UPFRONT',
        },
        undefined,
        ACTOR_ID
      );

      expect(order.status).toBe(OrderStatus.DRAFT);
      expect(order.paymentTerms).toBe(PaymentTerms.UPFRONT);
      expect(order.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(Number(order.paidAmount)).toBe(0);
      expect(Number(order.totalAmount)).toBe(1000000); // 10 * 100000
    });

    it('Should confirm UPFRONT PO without blocking', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 3, price: 100000 }],
        type: 'PURCHASE',
        paymentTerms: 'UPFRONT',
      });

      const confirmedOrder = await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      expect(confirmedOrder.status).toBe(OrderStatus.CONFIRMED);
      // paymentStatus should still be PENDING until payment is registered
      expect(confirmedOrder.paymentStatus).toBe(
        PaymentStatus.PENDING
      );
    });

    it('Should NOT create journal when posting PO (FR-003)', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 2, price: 100000 }],
        type: 'PURCHASE',
        paymentTerms: 'UPFRONT',
      });

      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      // Verify no journal entry was created for this PO
      const journals = await prisma.journalEntry.findMany({
        where: {
          companyId: COMPANY_ID,
          sourceId: order.id,
        },
      });

      expect(journals).toHaveLength(0);
    });
  });

  // Placeholder for future US2-US5 tests
  describe('US2: Register Upfront Payment', () => {
    it('Should register upfront payment and create journal (Dr 1600 Cr Cash)', async () => {
      // Create and confirm an UPFRONT PO
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 5, price: 100000 }],
        type: 'PURCHASE',
        paymentTerms: 'UPFRONT',
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      // Register upfront payment
      const { UpfrontPaymentService } =
        await import('../../src/modules/procurement/upfront-payment.service');
      const upfrontPaymentService = new UpfrontPaymentService();

      const payment = await upfrontPaymentService.registerPayment(
        COMPANY_ID,
        {
          orderId: order.id,
          amount: 500000, // Full amount
          method: 'BANK_TRANSFER',
          reference: 'TRF-001',
        },
        ACTOR_ID
      );

      expect(payment.orderId).toBe(order.id);
      expect(Number(payment.amount)).toBe(500000);
      expect(payment.paymentType).toBe('UPFRONT');

      // Verify journal was created
      const journals = await prisma.journalEntry.findMany({
        where: {
          companyId: COMPANY_ID,
          sourceId: payment.id,
        },
        include: { lines: true },
      });

      expect(journals).toHaveLength(1);
      expect(journals[0].reference).toContain('Upfront Payment');

      // Verify journal lines: Dr 1600, Cr 1200
      const lines = journals[0].lines;
      expect(lines).toHaveLength(2);

      const debitLine = lines.find((l) => Number(l.debit) > 0);
      const creditLine = lines.find((l) => Number(l.credit) > 0);

      expect(Number(debitLine?.debit)).toBe(500000);
      expect(Number(creditLine?.credit)).toBe(500000);
    });

    it('Should update PO paymentStatus to PAID_UPFRONT when fully paid', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 2, price: 50000 }],
        type: 'PURCHASE',
        paymentTerms: 'UPFRONT',
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const { UpfrontPaymentService } =
        await import('../../src/modules/procurement/upfront-payment.service');
      const upfrontPaymentService = new UpfrontPaymentService();

      await upfrontPaymentService.registerPayment(
        COMPANY_ID,
        {
          orderId: order.id,
          amount: 100000, // Full amount
          method: 'CASH',
        },
        ACTOR_ID
      );

      // Verify order status updated
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });

      expect(updatedOrder?.paymentStatus).toBe(
        PaymentStatus.PAID_UPFRONT
      );
      expect(Number(updatedOrder?.paidAmount)).toBe(100000);
    });

    it('Should prevent payment exceeding PO amount', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 1, price: 100000 }],
        type: 'PURCHASE',
        paymentTerms: 'UPFRONT',
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const { UpfrontPaymentService } =
        await import('../../src/modules/procurement/upfront-payment.service');
      const upfrontPaymentService = new UpfrontPaymentService();

      await expect(
        upfrontPaymentService.registerPayment(
          COMPANY_ID,
          {
            orderId: order.id,
            amount: 200000, // Exceeds PO amount
            method: 'CASH',
          },
          ACTOR_ID
        )
      ).rejects.toThrow(/exceeds/i);
    });
  });

  describe('US3: Receive Goods After Payment', () => {
    it('Should allow GRN for PAID_UPFRONT PO', async () => {
      // 1. Setup: Create and Pay PO
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 5, price: 100000 }],
        type: 'PURCHASE',
        paymentTerms: 'UPFRONT',
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const { UpfrontPaymentService } =
        await import('../../src/modules/procurement/upfront-payment.service');
      const upfrontPaymentService = new UpfrontPaymentService();
      await upfrontPaymentService.registerPayment(
        COMPANY_ID,
        {
          orderId: order.id,
          amount: 500000,
          method: 'BANK_TRANSFER',
        },
        ACTOR_ID
      );

      // 2. Receive Goods
      const { InventoryService } =
        await import('../../src/modules/inventory/inventory.service');
      const inventoryService = new InventoryService();
      const orderItems = await procurementService.getItems(order.id);

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        date: new Date().toISOString(),
        items: [
          {
            productId: orderItems[0].productId,
            quantity: 5,
          },
        ],
      });

      expect(grn).toBeDefined();
      expect(grn.purchaseOrderId).toBe(order.id);
    });
  });

  describe('US4: Bill with Prepaid Info', () => {
    it('Should strictly enforce UPFRONT payment terms on Bill even if NET30 requested', async () => {
      // 1. Setup: PO -> Confirm -> Pay -> GRN
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 10, price: 100000 }], // 1,000,000
        type: 'PURCHASE',
        paymentTerms: 'UPFRONT',
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      // Pay Upfront
      const { UpfrontPaymentService } =
        await import('../../src/modules/procurement/upfront-payment.service');
      const upfrontPaymentService = new UpfrontPaymentService();
      await upfrontPaymentService.registerPayment(
        COMPANY_ID,
        {
          orderId: order.id,
          amount: 1000000,
          method: 'BANK_TRANSFER',
        },
        ACTOR_ID
      );

      // Create GRN
      const { InventoryService } =
        await import('../../src/modules/inventory/inventory.service');
      const inventoryService = new InventoryService();

      const orderItems = await procurementService.getItems(order.id);

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        date: new Date().toISOString(),
        items: [{ productId: orderItems[0].productId, quantity: 10 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      // 2. Create Bill - Attempting to ignore Upfront terms
      const { BillService } =
        await import('../../src/modules/accounting/services/bill.service');
      const billService = new BillService();

      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId: order.id,
          paymentTermsString: 'NET30', // Trying to override
          dueDate: new Date(),
        }
      );

      // 3. Verify Enforcement
      expect(bill.orderId).toBe(order.id);
      expect(bill.paymentTermsString).toBe('UPFRONT'); // Should be enforced
      expect(bill.paymentTermsString).not.toBe('NET30');
    });
  });

  describe('US5: Settlement Prepaid vs AP', () => {
    it('Should settle prepaid against AP and create journal (Dr 2100 Cr 1600)', async () => {
      // 1. Setup: PO -> Confirm -> Pay -> GRN -> Post GRN
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 2, price: 100000 }], // 200,000
        type: 'PURCHASE',
        paymentTerms: 'UPFRONT',
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const { UpfrontPaymentService } =
        await import('../../src/modules/procurement/upfront-payment.service');
      const upfrontPaymentService = new UpfrontPaymentService();
      const payment = await upfrontPaymentService.registerPayment(
        COMPANY_ID,
        {
          orderId: order.id,
          amount: 200000,
          method: 'CASH',
        },
        ACTOR_ID
      );

      const { InventoryService } =
        await import('../../src/modules/inventory/inventory.service');
      const inventoryService = new InventoryService();
      const orderItems = await procurementService.getItems(order.id);
      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId: orderItems[0].productId, quantity: 2 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      // 2. Create and Post Bill
      const { BillService } =
        await import('../../src/modules/accounting/services/bill.service');
      const billService = new BillService();
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

      // 3. Verify Settlement
      // Bill should be PAID because 200k was prepaid and bill is 200k (0% tax default)
      expect(postedBill.status).toBe(InvoiceStatus.PAID);
      expect(Number(postedBill.balance)).toBe(0);

      // Verify settlement journal: Dr 2100, Cr 1600
      const journals = await prisma.journalEntry.findMany({
        where: {
          companyId: COMPANY_ID,
          sourceId: `${payment.id}:settlement`,
        },
        include: {
          lines: {
            include: { account: true },
          },
        },
        // Add ordering to ensure we get exactly what we want if there are multiple
        orderBy: { createdAt: 'desc' },
      });

      expect(journals).toHaveLength(1);
      expect(journals[0].reference).toContain('Settle Prepaid');

      const lines = journals[0].lines;
      const drAP = (lines as any[]).find(
        (l) => l.account.code === '2100' && Number(l.debit) > 0
      );
      const crAdvances = (lines as any[]).find(
        (l) => l.account.code === '1600' && Number(l.credit) > 0
      );

      expect(drAP).toBeDefined();
      expect(crAdvances).toBeDefined();
      expect(Number(drAP?.debit)).toBe(200000);
      expect(Number(crAdvances?.credit)).toBe(200000);

      // Verify Order status
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(updatedOrder?.paymentStatus).toBe(PaymentStatus.SETTLED);
    });
  });
});
