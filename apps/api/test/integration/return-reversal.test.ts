import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma } from '@sync-erp/database';
import { SalesService } from '@modules/sales/sales.service';
import { JournalService } from '@modules/accounting/services/journal.service';

const salesOrderService = new SalesService();
const journalService = new JournalService();

const COMPANY_ID = 'test-return-reversal-001';

describe('US3: Sales Return Reversal', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Return Test Company' },
      update: {},
    });

    // 2. Setup Accounts
    const accounts = [
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
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

    // 3. Setup Partner
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Return Customer',
        type: 'CUSTOMER',
        email: `returncust-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // 4. Setup Product with Cost
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `RET-PROD-${Date.now()}`,
        name: 'Returnable Product',
        price: 200000,
        averageCost: 150000,
        stockQty: 10,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup cascade
    await prisma.journalEntry.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.orderItem.deleteMany({
      where: { order: { companyId: COMPANY_ID } },
    });
    await prisma.order.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.product.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.account.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.partner.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.company.delete({ where: { id: COMPANY_ID } });
  });

  it.skip('should reverse COGS and increase stock when return is processed', async () => {
    // 1. Create Sales Order
    const order = await salesOrderService.create(COMPANY_ID, {
      partnerId,
      items: [{ productId, quantity: 2, price: 200000 }],
    });

    // Auto-confirm for shipment
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'CONFIRMED' },
    });

    // 2. Process Shipment (Trigger COGS)
    // Cost: 2 * 150,000 = 300,000
    await salesOrderService.ship(COMPANY_ID, order.id);

    // Verify Stock Reduced
    const shippedProduct = await prisma.product.findUnique({
      where: { id: productId },
    });
    expect(shippedProduct?.stockQty).toBe(8); // 10 - 2

    // 3. Process Return for 1 item
    // Reversal: 1 * 150,000 = 150,000
    /* await salesOrderService.returnOrder(COMPANY_ID, order.id, [
      { productId, quantity: 1 },
    ]); */

    // 4. Verify Stock Increased
    const returnedProduct = await prisma.product.findUnique({
      where: { id: productId },
    });
    expect(returnedProduct?.stockQty).toBe(9); // 8 + 1

    // 5. Verify Journals
    const journals = await journalService.list(COMPANY_ID);

    // Find Return Journal
    const returnJournal = journals.find((j) =>
      j.reference?.includes('Return for order')
    ) as any;

    expect(returnJournal).toBeDefined();

    // Verify Lines: Dr 1400 (Asset), Cr 5000 (COGS)
    const assetLine = returnJournal.lines.find(
      (l: any) => l.account.code === '1400'
    );
    const cogsLine = returnJournal.lines.find(
      (l: any) => l.account.code === '5000'
    );

    expect(Number(assetLine?.debit)).toBe(150000);
    expect(Number(cogsLine?.credit)).toBe(150000);
  });
});
