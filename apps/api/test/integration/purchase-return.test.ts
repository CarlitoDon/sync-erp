import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma, OrderStatus } from '@sync-erp/database';
import { PurchaseOrderService } from '../../src/modules/procurement/purchase-order.service';
import { ProductService } from '../../src/modules/product/product.service';

const purchaseOrderService = new PurchaseOrderService();
const productService = new ProductService();

const COMPANY_ID = 'test-purchase-return-001';
const ACTOR_ID = 'test-user-001';

describe('P2P: Purchase Return (Mirroring O2C Return)', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test Purchase Return' },
      update: {},
    });

    // Setup Required Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
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
          type: acc.type as never,
          isActive: true,
        },
      });
    }

    // Setup Supplier
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Supplier Return',
        type: 'SUPPLIER',
        email: `supplier-return-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Product with initial stock of 0
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `P2P-RET-SKU-${Date.now()}`,
        name: 'Purchase Return Test Product',
        price: 100000,
        averageCost: 80000,
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
      prisma.invoice.deleteMany({
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

  it('should reverse GRNI accrual and decrease stock when purchase return processed', async () => {
    // 1. Create and confirm PO
    const order = await purchaseOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'PURCHASE',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 10, price: 100000 }],
    });
    await purchaseOrderService.confirm(
      order.id,
      COMPANY_ID,
      ACTOR_ID
    );

    // 2. Receive goods (creates GRN, stock IN)
    await purchaseOrderService.receive(order.id, COMPANY_ID);

    // Verify stock is now 10
    let product = await productService.getById(productId, COMPANY_ID);
    expect(product?.stockQty).toBe(10);

    // Verify PO is COMPLETED
    const po = await purchaseOrderService.getById(order.id, COMPANY_ID);
    expect(po?.status).toBe(OrderStatus.COMPLETED);

    // 3. Return partial goods (5 units)
    await purchaseOrderService.returnToPo(
      COMPANY_ID,
      order.id,
      [{ productId, quantity: 5 }],
      ACTOR_ID
    );

    // 4. Verify stock decreased to 5
    product = await productService.getById(productId, COMPANY_ID);
    expect(product?.stockQty).toBe(5);

    // 5. Verify GRNI reversal journal was created
    const journals = await prisma.journalEntry.findMany({
      where: {
        companyId: COMPANY_ID,
        memo: { contains: 'Purchase Return' },
      },
    });
    expect(journals.length).toBeGreaterThanOrEqual(1);
  });

  it('should fail to return more than received quantity', async () => {
    // 1. Create, confirm, and receive PO with 5 units
    const order = await purchaseOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'PURCHASE',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 5, price: 100000 }],
    });
    await purchaseOrderService.confirm(
      order.id,
      COMPANY_ID,
      ACTOR_ID
    );
    await purchaseOrderService.receive(order.id, COMPANY_ID);

    // 2. Try to return 10 units (more than received) - should fail
    await expect(
      purchaseOrderService.returnToPo(
        COMPANY_ID,
        order.id,
        [{ productId, quantity: 10 }],
        ACTOR_ID
      )
    ).rejects.toThrow(/available for return/i);
  });
});
