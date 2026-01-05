import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, OrderStatus } from '@sync-erp/database';
import { appRouter } from '../../src/trpc/router';
import { createContext } from '../../src/trpc/context';
import { CreatePurchaseOrderInput } from '@sync-erp/shared';
const createCaller = async (userId: string, companyId: string) => {
  const req = {
    context: {
      userId,
      companyId,
    },
  } as any;

  const ctx = await createContext({
    req,
    res: {} as any,
    info: {} as any,
  });

  return appRouter.createCaller({
    ...ctx,
    userPermissions: ['*:*'],
    idempotencyKey: undefined,
  });
};

describe('Purchase Order Zod Integration', () => {
  let companyId: string;
  let userId: string;
  let productId: string;
  let supplierId: string;

  beforeAll(async () => {
    // Setup test data
    const company = await prisma.company.create({
      data: { name: 'Test Company Zod PO' },
    });
    companyId = company.id;

    const user = await prisma.user.create({
      data: {
        email: `test-zod-po-${Date.now()}@example.com`,
        name: 'Test User',
        passwordHash: 'hash',
        // role: 'ADMIN', // User does not have role directly
      },
    });
    userId = user.id;

    const supplier = await prisma.partner.create({
      data: {
        name: 'Zod Supplier',
        type: 'SUPPLIER',
        companyId,
      },
    });
    supplierId = supplier.id;

    const product = await prisma.product.create({
      data: {
        sku: `ZOD-PO-${Date.now()}`,
        name: 'Zod Product',
        companyId,
        price: 100,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.orderItem.deleteMany({
      where: { order: { companyId } },
    });
    await prisma.order.deleteMany({ where: { companyId } });
    await prisma.product.deleteMany({ where: { companyId } });
    await prisma.partner.deleteMany({ where: { companyId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  it('should create a PO using generated Zod types', async () => {
    const caller = await createCaller(userId, companyId);

    const input: CreatePurchaseOrderInput = {
      partnerId: supplierId,
      type: 'PURCHASE',
      paymentTerms: 'NET30',

      items: [
        {
          productId,
          quantity: 5,
          price: 100,
        },
      ],
      taxRate: 10,
    };

    const po = await caller.purchaseOrder.create(input);

    expect(po).toBeDefined();
    expect(po.orderNumber).toContain('PO');
    expect(po.paymentTerms).toBe('NET30');
    expect(po.status).toBe(OrderStatus.DRAFT);
    expect(Number(po.totalAmount)).toBe(550); // 5 * 100 + 10% tax
  });
});
