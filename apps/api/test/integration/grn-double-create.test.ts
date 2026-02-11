import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma } from '@sync-erp/database';
import { InventoryService } from '../../src/modules/inventory/inventory.service';
import { PurchaseOrderService } from '../../src/modules/procurement/purchase-order.service';
import { SalesOrderService } from '../../src/modules/sales/sales-order.service';

const inventoryService = new InventoryService();
const purchaseOrderService = new PurchaseOrderService();
const salesOrderService = new SalesOrderService();

const COMPANY_ID = 'test-fulfillment-double-create-001';

describe('Fulfillment (GRN & Shipment) Double Creation Bug', () => {
  let productId: string;
  let partnerId: string;
  let customerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test Fulfillment Double' },
      update: {},
    });

    // Setup Required Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
      { code: '2105', name: 'GRNI Accrued', type: 'LIABILITY' },
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

    // Setup Supplier
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Supplier Double',
        type: 'SUPPLIER',
        email: `supplier-double-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Customer
    const customer = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Customer Double',
        type: 'CUSTOMER',
        email: `customer-double-${Date.now()}@test.com`,
      },
    });
    customerId = customer.id;

    // Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `DOUBLE-SKU-${Date.now()}`,
        name: 'Double Test Product',
        price: 150000, // Sales Price
        averageCost: 100000,
        stockQty: 100, // Initial stock for Shipment tests
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.$transaction([
      prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN (SELECT id FROM "JournalEntry" WHERE "companyId" = ${COMPANY_ID})`,
      prisma.journalEntry.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
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

  describe('Purchase Order -> GRN', () => {
    it('should not allow multiple DRAFT GRNs that exceed PO quantity', async () => {
      // 1. Create PO for 10 units
      const order = await purchaseOrderService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: 'NET30',
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      const orderId = order.id;

      // 2. Confirm PO
      await purchaseOrderService.confirm(
        orderId,
        COMPANY_ID,
        'test-user-id'
      );

      // 3. Create Draft GRN #1 for 10 units
      const grn1 = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: orderId,
        items: [{ productId, quantity: 10 }],
      });
      expect(grn1.status).toBe('DRAFT');

      // 4. Try to Create Draft GRN #2 for 10 units (Should Fail)
      await expect(
        inventoryService.createGRN(COMPANY_ID, {
          purchaseOrderId: orderId,
          items: [{ productId, quantity: 10 }],
        })
      ).rejects.toThrow(/Cannot receive 10 units/);
    });

    it('should allow creating new GRN after deleting DRAFT', async () => {
      // 1. Create PO
      const order = await purchaseOrderService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: 'NET30',
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await purchaseOrderService.confirm(
        order.id,
        COMPANY_ID,
        'test-user-id'
      );

      // 2. Create Draft #1 (Full qty)
      const grn1 = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 10 }],
      });

      // 3. Delete Draft #1
      await inventoryService.deleteGRN(COMPANY_ID, grn1.id);

      // 4. Create Draft #2 (Should succeed)
      const grn2 = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 10 }],
      });
      expect(grn2).toBeDefined();
      expect(grn2.status).toBe('DRAFT');
    });
  });

  describe('Sales Order -> Shipment', () => {
    it('should not allow multiple DRAFT Shipments that exceed SO quantity', async () => {
      // 1. Create SO for 5 units
      const order = await salesOrderService.create(COMPANY_ID, {
        partnerId: customerId,
        type: 'SALES',
        paymentTerms: 'NET30',
        items: [{ productId, quantity: 5, price: 150000 }],
      });

      await salesOrderService.confirm(
        order.id,
        COMPANY_ID,
        'test-user-id'
      );

      // 2. Create Draft Shipment #1 for 5 units
      const shp1 = await inventoryService.createShipment(COMPANY_ID, {
        salesOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      expect(shp1.status).toBe('DRAFT');

      // 3. Try to Create Draft Shipment #2 for 5 units (Should Fail)
      await expect(
        inventoryService.createShipment(COMPANY_ID, {
          salesOrderId: order.id,
          items: [{ productId, quantity: 5 }],
        })
      ).rejects.toThrow(/Cannot ship 5 units/);
    });

    it('should allow creating new Shipment after deleting DRAFT', async () => {
      // 1. Create SO for 5 units
      const order = await salesOrderService.create(COMPANY_ID, {
        partnerId: customerId,
        type: 'SALES',
        paymentTerms: 'NET30',
        items: [{ productId, quantity: 5, price: 150000 }],
      });

      await salesOrderService.confirm(
        order.id,
        COMPANY_ID,
        'test-user-id'
      );

      // 2. Create Draft Shipment #1
      const shp1 = await inventoryService.createShipment(COMPANY_ID, {
        salesOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });

      // 3. Delete Draft Shipment
      await inventoryService.deleteShipment(COMPANY_ID, shp1.id);

      // 4. Create Draft Shipment #2 (Should succeed)
      const shp2 = await inventoryService.createShipment(COMPANY_ID, {
        salesOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      expect(shp2.status).toBe('DRAFT');
    });
  });
});
