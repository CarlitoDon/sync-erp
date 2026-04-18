import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  OrderStatus,
  DocumentStatus,
  Fulfillment,
} from '@sync-erp/database';
import { InventoryService } from '@modules/inventory/inventory.service';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';
import { ProductService } from '@modules/product/product.service';

const inventoryService = new InventoryService();
const purchaseOrderService = new PurchaseOrderService();
const productService = new ProductService();

const COMPANY_ID = 'test-void-grn-001';

describe('P2P: Void GRN & Status Recalculation', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test Void GRN' },
      update: {},
    });

    // Setup Required Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '1500', name: 'VAT Receivable', type: 'ASSET' },
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
          type: acc.type as import("@sync-erp/database").AccountType,
          isActive: true,
        },
      });
    }

    // Setup Supplier
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Supplier Void GRN',
        type: 'SUPPLIER',
        email: `supplier-void-grn-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Product with initial stock of 0
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `VOID-GRN-SKU-${Date.now()}`,
        name: 'Void GRN Test Product',
        price: 100000,
        averageCost: 50000,
        stockQty: 0,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.$transaction([
      prisma.auditLog.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
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

  it('should void GRN and rollback stock & PO status', async () => {
    // 1. Create PO
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

    // 3. Receive goods (creates GRN and posts it)
    await purchaseOrderService.receive(orderId, COMPANY_ID);

    // Verify stock increased to 10
    let product = await productService.getById(productId, COMPANY_ID);
    expect(product?.stockQty).toBe(10);

    // Verify PO status is COMPLETED (Fully Received)
    let po = await purchaseOrderService.getById(orderId, COMPANY_ID);
    expect(po?.status).toBe(OrderStatus.COMPLETED);

    // 4. Get the GRN
    const grns = await inventoryService.listGRN(COMPANY_ID);
    const grn = grns.find((g) => g.orderId === orderId);
    expect(grn).toBeDefined();
    expect(grn?.status).toBe('POSTED');

    // 5. Void GRN with reason
    await inventoryService.voidGRN(
      COMPANY_ID,
      grn!.id,
      'Test void reason',
      undefined,
      'test-user-id',
      ['*:*'] // Admin permissions for test
    );

    // 6. Verify stock rolled back to 0
    product = await productService.getById(productId, COMPANY_ID);
    expect(product?.stockQty).toBe(0);

    // 7. Verify PO status recalculated to CONFIRMED (no GRNs posted)
    po = await purchaseOrderService.getById(orderId, COMPANY_ID);
    expect(po?.status).toBe(OrderStatus.CONFIRMED);

    // 8. Verify GRN status is VOIDED
    const voidedGrn = await inventoryService.getGRN(
      COMPANY_ID,
      grn!.id
    );
    expect(voidedGrn?.status).toBe('VOIDED');
  });

  it('should fail to void already voided GRN', async () => {
    // 1. Create and receive another PO
    const order = await purchaseOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'PURCHASE',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 5, price: 100000 }],
    });
    await purchaseOrderService.confirm(
      order.id,
      COMPANY_ID,
      'test-user-id'
    );
    await purchaseOrderService.receive(order.id, COMPANY_ID);

    // 2. Get the GRN
    const grns = await inventoryService.listGRN(COMPANY_ID);
    const grn = grns.find(
      (g: Fulfillment) =>
        g.orderId === order.id && g.status === DocumentStatus.POSTED
    );
    expect(grn).toBeDefined();

    // 3. Void once
    await inventoryService.voidGRN(
      COMPANY_ID,
      grn!.id,
      'First void',
      undefined,
      'test-user-id',
      ['*:*'] // Admin permissions for test
    );

    // 4. Attempt to void again - should fail
    await expect(
      inventoryService.voidGRN(
        COMPANY_ID,
        grn!.id,
        'Second void',
        undefined,
        'test-user-id',
        ['*:*'] // Admin permissions for test
      )
    ).rejects.toThrow();
  });

  it('should fail to void non-existent GRN (matching O2C)', async () => {
    await expect(
      inventoryService.voidGRN(
        COMPANY_ID,
        '00000000-0000-0000-0000-000000000000',
        'Test reason',
        undefined,
        'test-user-id',
        ['*:*']
      )
    ).rejects.toThrow();
  });
});
