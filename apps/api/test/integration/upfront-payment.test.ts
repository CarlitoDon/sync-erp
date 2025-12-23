import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  OrderStatus,
  PaymentTerms,
  PaymentStatus,
} from '@sync-erp/database';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';

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
  describe.skip('US2: Register Upfront Payment', () => {
    it.todo(
      'Should register upfront payment and create journal (Dr 1600 Cr 1200)'
    );
    it.todo(
      'Should update PO paymentStatus to PAID_UPFRONT when fully paid'
    );
    it.todo('Should prevent payment exceeding PO amount');
  });

  describe.skip('US3: Receive Goods After Payment', () => {
    it.todo('Should allow GRN for PAID_UPFRONT PO');
    it.todo('Should create GRN journal (Dr 1400 Cr 2105)');
  });

  describe.skip('US4: Bill with Prepaid Info', () => {
    it.todo('Should show prepaid info on bill for UPFRONT PO');
  });

  describe.skip('US5: Settlement Prepaid vs AP', () => {
    it.todo(
      'Should settle prepaid against AP and create journal (Dr 2100 Cr 1600)'
    );
  });
});
