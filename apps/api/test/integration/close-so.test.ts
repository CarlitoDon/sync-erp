import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma, OrderStatus } from '@sync-erp/database';
import { SalesOrderService } from '@modules/sales/sales-order.service';

const salesOrderService = new SalesOrderService();

const COMPANY_ID = 'test-close-so-001';

describe('O2C: Close SO (Force Complete)', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test Close SO' },
      update: {},
    });

    // Setup Required Accounts
    const accounts = [
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
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

    // Setup Customer
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Customer Close SO',
        type: 'CUSTOMER',
        email: `customer-close-so-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Product with Stock
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `CLOSE-SO-SKU-${Date.now()}`,
        name: 'Close SO Test Product',
        price: 200000,
        averageCost: 100000,
        stockQty: 100, // Ensure enough stock for orders
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
      prisma.order.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.product.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.account.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.delete({ where: { id: COMPANY_ID } }),
    ]);
  });

  it('should close confirmed SO with reason', async () => {
    // 1. Create SO
    const order = await salesOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'SALES',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 10, price: 200000 }],
    });

    // 2. Confirm
    await salesOrderService.confirm(
      order.id,
      COMPANY_ID,
      'test-user-id'
    );

    // 3. Close SO (e.g., customer cancelled order)
    const reason = 'Customer cancelled order';
    await salesOrderService.close(
      order.id,
      COMPANY_ID,
      'test-user-id',
      reason
    );

    // 4. Verify Status
    const closedOrder = await salesOrderService.getById(
      order.id,
      COMPANY_ID
    );
    expect(closedOrder?.status).toBe(OrderStatus.COMPLETED);

    // 5. Verify Audit Log
    const logs = await prisma.auditLog.findMany({
      where: {
        entityId: order.id,
        action: 'ORDER_CANCELLED',
      },
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[logs.length - 1].payloadSnapshot).toMatchObject({
      reason,
    });
  });

  it('should fail to close DRAFT SO', async () => {
    const order = await salesOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'SALES',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 10, price: 200000 }],
    });

    await expect(
      salesOrderService.close(
        order.id,
        COMPANY_ID,
        'test-user-id',
        'reason'
      )
    ).rejects.toThrow();
  });
});
