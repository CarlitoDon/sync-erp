import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  OrderStatus,
  OrderType,
  PaymentTerms,
} from '@sync-erp/database';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';

const purchaseOrderService = new PurchaseOrderService();

const COMPANY_ID = 'test-optlock-001';
const USER_ID = 'test-user-optlock';

describe('Optimistic Locking - Concurrent Update Prevention', () => {
  let partnerId: string;
  let productId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test Optimistic Lock' },
      update: {},
    });

    // Setup Supplier
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Supplier OptLock',
        type: 'SUPPLIER',
        email: `supplier-optlock-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `OPTLOCK-SKU-${Date.now()}`,
        name: 'OptLock Test Product',
        price: 100000,
        averageCost: 50000,
        stockQty: 0,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.$transaction([
      prisma.orderItem.deleteMany({
        where: { order: { companyId: COMPANY_ID } },
      }),
      prisma.order.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.product.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.deleteMany({ where: { id: COMPANY_ID } }),
    ]);
  });

  it('should reject concurrent modification with stale version', async () => {
    // 1. Create a PO
    const po = await purchaseOrderService.create(COMPANY_ID, {
      partnerId,
      type: OrderType.PURCHASE,
      paymentTerms: PaymentTerms.NET_30,
      items: [{ productId, quantity: 10, price: 100000 }],
    });

    // Verify initial version is 1
    expect(po.version).toBe(1);

    // 2. Simulate concurrent read - both users read version 1
    const orderSnapshot1 = await prisma.order.findUnique({
      where: { id: po.id },
    });
    const orderSnapshot2 = await prisma.order.findUnique({
      where: { id: po.id },
    });

    expect(orderSnapshot1!.version).toBe(1);
    expect(orderSnapshot2!.version).toBe(1);

    // 3. First user confirms (succeeds, version 1 -> 2)
    const confirmed = await purchaseOrderService.confirm(
      po.id,
      COMPANY_ID,
      USER_ID
    );
    expect(confirmed.version).toBe(2);
    expect(confirmed.status).toBe(OrderStatus.CONFIRMED);

    // 4. Second user tries to cancel with stale version 1
    // This should fail because version is now 2
    await expect(
      prisma.order.updateMany({
        where: { id: po.id, version: 1 }, // Stale version!
        data: {
          status: OrderStatus.CANCELLED,
          version: { increment: 1 },
        },
      })
    ).resolves.toEqual({ count: 0 }); // No rows updated = version mismatch

    // 5. Verify order is still CONFIRMED (not cancelled)
    const finalOrder = await prisma.order.findUnique({
      where: { id: po.id },
    });
    expect(finalOrder!.status).toBe(OrderStatus.CONFIRMED);
    expect(finalOrder!.version).toBe(2);
  });

  it('should allow update with correct version', async () => {
    // Create and confirm a PO
    const po = await purchaseOrderService.create(COMPANY_ID, {
      partnerId,
      type: OrderType.PURCHASE,
      paymentTerms: PaymentTerms.NET_30,
      items: [{ productId, quantity: 5, price: 50000 }],
    });

    await purchaseOrderService.confirm(po.id, COMPANY_ID, USER_ID);

    // Update with correct version (v2 after confirm)
    const result = await prisma.order.updateMany({
      where: { id: po.id, version: 2 },
      data: {
        notes: 'Updated with correct version',
        version: { increment: 1 },
      },
    });

    expect(result.count).toBe(1); // Success!

    const updated = await prisma.order.findUnique({
      where: { id: po.id },
    });
    expect(updated!.version).toBe(3);
    expect(updated!.notes).toBe('Updated with correct version');
  });
});
