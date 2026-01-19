import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma, BusinessShape } from '@sync-erp/database';
import { appRouter } from '../../src/trpc/router';
import { PurchaseOrderService } from '../../src/modules/procurement/purchase-order.service';
import { AccountService } from '../../src/modules/accounting/services/account.service';

const procurementService = new PurchaseOrderService();
const accountService = new AccountService();

const COMPANY_ID = 'test-idempotency-001';
const ACTOR_ID = 'test-user-idev-001';

describe('Backend Idempotency Integration', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Test Idempotency',
        businessShape: BusinessShape.RETAIL,
      },
      update: {},
    });

    // Setup Accounts (Required for GRN Journal)
    await accountService.seedDefaultAccounts(COMPANY_ID);

    // Setup Partner
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Idempotent Supplier',
        type: 'SUPPLIER',
        email: `idem-supplier-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `IDEM-PROD-${Date.now()}`,
        name: 'Idempotent Product',
        price: 100,
        stockQty: 100,
      },
    });
    productId = product.id;

    // Setup accounts (minimal for bill posting if needed, but we focus on creation which is simpler)
    // Bill creation doesn't require accounts usually, only posting does.
    // We strictly test bill creation here.
  });

  afterAll(async () => {
    // Cleanup
    await prisma.idempotencyKey.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    // Cleanup Invoices first (FK to Order)
    await prisma.invoice.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    // Cleanup Fulfillments & Items
    await prisma.fulfillmentItem.deleteMany({
      where: { fulfillment: { companyId: COMPANY_ID } },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.fulfillment.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    // Cleanup Journals
    await prisma.journalEntry.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    // Cleanup Items
    await prisma.orderItem.deleteMany({
      where: { order: { companyId: COMPANY_ID } },
    });
    // Cleanup Accounts
    await prisma.account.deleteMany({
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
    await prisma.company.delete({ where: { id: COMPANY_ID } });
  });

  it('should create only ONE bill when called sequentially with same idempotency key', async () => {
    // 1. Create and Confirm PO
    const order = await procurementService.create(COMPANY_ID, {
      partnerId,
      type: 'PURCHASE',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 10, price: 100 }],
    });
    await procurementService.confirm(order.id, COMPANY_ID, ACTOR_ID);
    await procurementService.receive(
      order.id,
      COMPANY_ID,
      'GRN-TEST-SEQ'
    );

    const idempotencyKey = `key-seq-${Date.now()}`;

    // Create Caller with idempotency key
    const ctx = {
      req: {} as any,
      res: {} as any,
      userId: ACTOR_ID,
      companyId: COMPANY_ID,
      businessShape: BusinessShape.RETAIL,
      userPermissions: ['*:*'],
      userRole: 'ADMIN' as any,
      idempotencyKey,
      correlationId: undefined,
    };
    const caller = appRouter.createCaller(ctx);

    // Call 1
    const bill1 = await caller.bill.createFromPO({
      orderId: order.id,
    });
    expect(bill1).toBeDefined();

    // Call 2 (Replay)
    const bill2 = await caller.bill.createFromPO({
      orderId: order.id,
    });
    expect(bill2).toBeDefined();

    // Assertions
    expect(bill1.id).toBe(bill2.id); // Should be exactly same ID

    // DB Verification
    const count = await prisma.invoice.count({
      where: { id: bill1.id },
    });
    expect(count).toBe(1);

    // Verify IdempotencyKey record
    const keyRecord = await prisma.idempotencyKey.findUnique({
      where: { id: idempotencyKey },
    });
    expect(keyRecord?.status).toBe('COMPLETED');
    expect(keyRecord?.response).toBeDefined();
  });

  it('should handle concurrent race conditions safely', async () => {
    // Create a new PO for this test
    const order = await procurementService.create(COMPANY_ID, {
      partnerId,
      type: 'PURCHASE',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 20, price: 100 }],
    });
    await procurementService.confirm(order.id, COMPANY_ID, ACTOR_ID);
    await procurementService.receive(
      order.id,
      COMPANY_ID,
      'GRN-TEST-CONC'
    );

    const idempotencyKey = `key-conc-${Date.now()}`;
    const ctx = {
      req: {} as any,
      res: {} as any,
      userId: ACTOR_ID,
      companyId: COMPANY_ID,
      businessShape: BusinessShape.RETAIL,
      userPermissions: ['*:*'],
      userRole: 'ADMIN' as any,
      idempotencyKey,
      correlationId: undefined,
    };
    const caller = appRouter.createCaller(ctx);

    // Simulate concurrent calls using Promise.all
    // Note: In real world, one might fail with CONFLICT, and client should retry or handle it.
    // Our implementation throws conflict if PROCESSING.
    // If one is fast enough to finish before other starts check, both succeed (return result).

    const p1 = caller.bill.createFromPO({ orderId: order.id });
    const p2 = caller.bill.createFromPO({ orderId: order.id });

    const results = await Promise.allSettled([p1, p2]);

    // At least one must succeed
    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(succeeded.length).toBeGreaterThanOrEqual(1);

    if (failed.length > 0) {
      // If one failed, it MUST be a Conflict error
      const reason = (failed[0] as PromiseRejectedResult).reason;
      // TRPC error structure?
      // Check if message contains 'processing' or code CONFLICT
      expect(reason.message).toMatch(/process|conflict/i);
    } else {
      // Both succeeded (sequential execution within JS event loop or fast completion)
      // Ensure they returned the SAME object ID
      const val1 = (succeeded[0] as PromiseFulfilledResult<any>)
        .value;
      const val2 = (succeeded[1] as PromiseFulfilledResult<any>)
        .value;
      expect(val1.id).toBe(val2.id);
    }

    // Verify DB count
    // Find bills for this order
    const bills = await prisma.invoice.findMany({
      where: { orderId: order.id },
    });
    expect(bills.length).toBe(1);
  });
});
