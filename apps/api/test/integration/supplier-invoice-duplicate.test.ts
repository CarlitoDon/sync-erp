import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma } from '@sync-erp/database';
import { BillService } from '@modules/accounting/services/bill.service';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';

const billService = new BillService();
const purchaseOrderService = new PurchaseOrderService();

const COMPANY_ID = 'test-dup-invoice-001';

describe('P2P: Supplier Invoice Duplicate Check', () => {
  let productId: string;
  let partnerId: string;
  let partnerId2: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test Duplicate Invoice' },
      update: {},
    });

    // Setup Required Accounts
    const accounts = [
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
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
          type: acc.type as import("@sync-erp/database").AccountType,
          isActive: true,
        },
      });
    }

    // Setup Suppliers
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Supplier A',
        type: 'SUPPLIER',
        email: `supplier-a-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    const partner2 = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Supplier B',
        type: 'SUPPLIER',
        email: `supplier-b-${Date.now()}@test.com`,
      },
    });
    partnerId2 = partner2.id;

    // Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `DUP-INV-SKU-${Date.now()}`,
        name: 'Test Product',
        price: 100000,
        averageCost: 50000,
        stockQty: 0,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.journalEntry.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.invoiceItem.deleteMany({
      where: { invoice: { companyId: COMPANY_ID } },
    });
    await prisma.invoice.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    // Fix FK: Delete Fulfillment items -> Fulfillments -> Order items -> Orders
    await prisma.inventoryMovement.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.fulfillmentItem.deleteMany({
      where: { fulfillment: { companyId: COMPANY_ID } },
    });
    await prisma.fulfillment.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.order.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.product.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.partner.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.account.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.company.delete({ where: { id: COMPANY_ID } });
  });

  it('should prevent duplicate supplier invoice numbers for the same supplier', async () => {
    // 1. Create POs
    const order1 = await purchaseOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'PURCHASE',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 10, price: 100000 }],
    });
    await purchaseOrderService.confirm(
      order1.id,
      COMPANY_ID,
      'test-user-id'
    );
    await purchaseOrderService.receive(order1.id, COMPANY_ID);

    const order2 = await purchaseOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'PURCHASE',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 10, price: 100000 }],
    });
    await purchaseOrderService.confirm(
      order2.id,
      COMPANY_ID,
      'test-user-id'
    );
    await purchaseOrderService.receive(order2.id, COMPANY_ID);

    const invoiceNum = 'INV-DUP-TEST-001';

    // 2. Create Bill 1
    await billService.createFromPurchaseOrder(COMPANY_ID, {
      orderId: order1.id,
      supplierInvoiceNumber: invoiceNum,
      businessDate: new Date(),
    });

    // 3. Create Bill 2 with SAME supplier invoice number -> Should Fail
    await expect(
      billService.createFromPurchaseOrder(COMPANY_ID, {
        orderId: order2.id,
        supplierInvoiceNumber: invoiceNum,
        businessDate: new Date(),
      })
    ).rejects.toThrow(/already exists/); // E104
  });

  it('should allow same invoice number for DIFFERENT suppliers', async () => {
    // 1. Create PO for Supplier B
    const order3 = await purchaseOrderService.create(COMPANY_ID, {
      partnerId: partnerId2, // Different supplier
      type: 'PURCHASE',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 10, price: 100000 }],
    });
    await purchaseOrderService.confirm(
      order3.id,
      COMPANY_ID,
      'test-user-id'
    );
    await purchaseOrderService.receive(order3.id, COMPANY_ID);

    const invoiceNum = 'INV-DUP-TEST-001'; // Same number used by Supplier A above

    // 2. Create Bill -> Should Succeed
    await expect(
      billService.createFromPurchaseOrder(COMPANY_ID, {
        orderId: order3.id,
        supplierInvoiceNumber: invoiceNum,
        businessDate: new Date(),
      })
    ).resolves.toBeDefined();
  });
});
