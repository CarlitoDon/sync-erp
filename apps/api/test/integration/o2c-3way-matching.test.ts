import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma, InvoiceStatus } from '@sync-erp/database';
import { InvoiceService } from '../../src/modules/accounting/services/invoice.service';
import { SalesOrderService } from '../../src/modules/sales/sales-order.service';

const invoiceService = new InvoiceService();
const salesOrderService = new SalesOrderService();

const COMPANY_ID = 'test-o2c-3way-001';
const ACTOR_ID = 'test-user-001';

describe('O2C: 3-Way Matching Validation (Mirroring P2P)', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test O2C 3-Way Match' },
      update: {},
    });

    // Setup Required Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '4100', name: 'Sales Revenue', type: 'REVENUE' },
      { code: '5000', name: 'COGS', type: 'EXPENSE' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
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

    // Setup Customer
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Customer 3-Way',
        type: 'CUSTOMER',
        email: `customer-3way-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `O2C-3WAY-SKU-${Date.now()}`,
        name: 'Test O2C 3-Way Product',
        price: 200000,
        averageCost: 100000,
        stockQty: 100,
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
      prisma.invoice.deleteMany({ where: { companyId: COMPANY_ID } }),
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
      prisma.inventoryMovement.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.product.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.account.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.delete({ where: { id: COMPANY_ID } }),
    ]);
  });

  describe('Normal NET30 Flow (3-Way Matching Enforced)', () => {
    it('should pass 3-way matching when qty matches shipped qty', async () => {
      // 1. Create and Confirm SO
      const order = await salesOrderService.create(COMPANY_ID, {
        partnerId,
        type: 'SALES',
        paymentTerms: 'NET30',
        items: [{ productId, quantity: 10, price: 200000 }],
      });
      await salesOrderService.confirm(order.id, COMPANY_ID, ACTOR_ID);

      // 2. Ship Goods (Simulation of GRN in P2P)
      await salesOrderService.ship(COMPANY_ID, order.id);

      // 3. Create Invoice matching shipped qty
      const invoice = await invoiceService.createFromSalesOrder(
        COMPANY_ID,
        {
          orderId: order.id,
          taxRate: 0,
        }
      );

      // 4. Post Invoice - should pass
      const postedInvoice = await invoiceService.post(
        invoice.id,
        COMPANY_ID,
        undefined,
        undefined,
        undefined,
        undefined,
        ACTOR_ID
      );

      expect(postedInvoice.status).toBe(InvoiceStatus.POSTED);
    });

    it('should fail 3-way matching when invoicing more than shipped', async () => {
      // 1. Create and Confirm SO for 20 units
      const order = await salesOrderService.create(COMPANY_ID, {
        partnerId,
        type: 'SALES',
        paymentTerms: 'NET30',
        items: [{ productId, quantity: 20, price: 200000 }],
      });
      await salesOrderService.confirm(order.id, COMPANY_ID, ACTOR_ID);

      // 2. PARTIAL Shipment: Ship only 15 units
      // Mocking partial shipment by intercepting or using specific method if available
      await salesOrderService.ship(COMPANY_ID, order.id);

      // Fetch the created Fulfillment (Shipment)
      const shipment = await prisma.fulfillment.findFirst({
        where: {
          companyId: COMPANY_ID,
          orderId: order.id,
          type: 'SHIPMENT', // FulfillmentType.SHIPMENT
        },
      });

      if (!shipment) throw new Error('Shipment not found');

      const ffmItem = await prisma.fulfillmentItem.findFirst({
        where: { fulfillmentId: shipment.id },
      });

      if (ffmItem) {
        await prisma.fulfillmentItem.update({
          where: { id: ffmItem.id },
          data: { quantity: 15 }, // Artificially reduce shipped qty
        });
      }

      // 3. Create Invoice (will pull 20 from Order)
      const invoice = await invoiceService.createFromSalesOrder(
        COMPANY_ID,
        {
          orderId: order.id,
          taxRate: 0,
        }
      );

      // 4. Post Invoice - Should Fail 3-Way Match (Invoice 20 > Shipped 15)
      await expect(
        invoiceService.post(
          invoice.id,
          COMPANY_ID,
          undefined,
          undefined,
          undefined,
          undefined,
          ACTOR_ID
        )
      ).rejects.toThrow(/qty mismatch|exceeds shipped/i);
    });
  });

  describe('DP Invoice (3-Way Matching Skipped)', () => {
    it('should skip 3-way matching for DP Invoices', async () => {
      // 1. Create SO with DP
      const order = await salesOrderService.create(COMPANY_ID, {
        partnerId,
        type: 'SALES',
        paymentTerms: 'NET30',
        dpPercent: 30, // 30% Down Payment
        items: [{ productId, quantity: 5, price: 200000 }],
      });

      // 2. Confirm SO - Auto creates DP Invoice
      await salesOrderService.confirm(order.id, COMPANY_ID, ACTOR_ID);

      // 3. Find DP Invoice
      const dpInvoice = await prisma.invoice.findFirst({
        where: {
          orderId: order.id,
          companyId: COMPANY_ID,
          notes: { contains: 'Down Payment' },
        },
      });

      expect(dpInvoice).toBeDefined();
      expect(dpInvoice?.status).toBe(InvoiceStatus.DRAFT);

      // 4. Post DP Invoice - Should pass even though NOTHING is shipped yet
      const posted = await invoiceService.post(
        dpInvoice!.id,
        COMPANY_ID,
        undefined,
        undefined,
        undefined,
        undefined,
        ACTOR_ID
      );

      expect(posted.status).toBe(InvoiceStatus.POSTED);
    });
  });
});
