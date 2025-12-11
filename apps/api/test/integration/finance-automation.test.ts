import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@sync-erp/database';
import { InventoryService } from '../../src/services/InventoryService';
import { JournalService } from '../../src/services/JournalService';
import { FulfillmentService } from '../../src/services/FulfillmentService';

const inventoryService = new InventoryService();
const journalService = new JournalService();
const fulfillmentService = new FulfillmentService();

const COMPANY_ID = 'test-finance-integration-001';

describe('Finance Automation Integration', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test Finance Company' },
      update: {},
    });

    // 2. Setup Accounts
    const accounts = [
      { code: '5000', name: 'COGS', type: 'EXPENSE' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '5200', name: 'Inventory Adj', type: 'EXPENSE' },
    ];

    for (const acc of accounts) {
      await prisma.account.upsert({
        where: { companyId_code: { companyId: COMPANY_ID, code: acc.code } },
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

    // 3. Setup Partner (Customer)
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Customer',
        type: 'CUSTOMER',
        email: `customer-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // 4. Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `TEST-SKU-${Date.now()}`,
        name: 'Test Product',
        price: 150000,
        // Initial Cost 100,000, Qty 10
        averageCost: 100000,
        stockQty: 10,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup
    const deleteJournals = prisma.journalEntry.deleteMany({ where: { companyId: COMPANY_ID } });
    const deleteMovements = prisma.inventoryMovement.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deleteOrderItems = prisma.orderItem.deleteMany({
      where: { order: { companyId: COMPANY_ID } },
    });
    const deleteOrders = prisma.order.deleteMany({ where: { companyId: COMPANY_ID } });
    const deleteProducts = prisma.product.deleteMany({ where: { companyId: COMPANY_ID } });
    const deleteAccounts = prisma.account.deleteMany({ where: { companyId: COMPANY_ID } });
    const deletePartners = prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } });
    const deleteCompany = prisma.company.delete({ where: { id: COMPANY_ID } });

    await prisma.$transaction([
      deleteJournals,
      deleteMovements,
      deleteOrderItems,
      deleteOrders,
      deleteProducts,
      deleteAccounts,
      deletePartners,
      deleteCompany,
    ]);
  });

  describe('US1: Sales Shipment COGS', () => {
    it('should create COGS journal when shipment is processed', async () => {
      // 1. Create Order
      const order = await prisma.order.create({
        data: {
          companyId: COMPANY_ID,
          orderNumber: `SO-${Date.now()}`,
          status: 'CONFIRMED',
          totalAmount: 300000,
          type: 'SALES',
          partnerId,
          items: {
            create: [{ productId, quantity: 2, price: 150000 }],
          },
        },
      });

      // 2. Process Shipment (Cost = 2 * 100,000 = 200,000)
      await fulfillmentService.processShipment(COMPANY_ID, { orderId: order.id });

      // 3. Verify Journal
      const journals = await journalService.list(COMPANY_ID);
      const shipmentJournal = journals.find((j: any) =>
        j.reference?.includes(`Shipment for Order ${order.orderNumber}`)
      ) as any;

      expect(shipmentJournal).toBeDefined();
      expect(shipmentJournal.lines).toHaveLength(2);

      const drLine = shipmentJournal.lines.find((l: any) => l.account.code === '5000');
      const crLine = shipmentJournal.lines.find((l: any) => l.account.code === '1400');

      expect(Number(drLine?.debit)).toBe(200000);
      expect(Number(crLine?.credit)).toBe(200000);
    });
  });

  describe('US2: Stock Adjustment', () => {
    it('should create Expense journal for Negative Adjustment (Loss)', async () => {
      // Initial Stock: 10 - 2 (shipped) = 8.
      // Adjustment: -1. Cost @ 100,000.
      const movement = await inventoryService.adjustStock(COMPANY_ID, {
        productId,
        quantity: -1, // Loss
        costPerUnit: 0, // Ignored for loss
        reference: 'Loss Check',
      });

      const journals = await journalService.list(COMPANY_ID);
      // Fix: Look for the specific reference we passed
      const adjJournal = journals.find((j: any) => j.reference === 'Loss Check') as any;

      expect(adjJournal).toBeDefined();
      expect(adjJournal.lines).toHaveLength(2);

      // Dr 5200 (Expense), Cr 1400 (Asset)
      const drLine = adjJournal.lines.find((l: any) => l.account.code === '5200');
      const crLine = adjJournal.lines.find((l: any) => l.account.code === '1400');

      expect(Number(drLine?.debit)).toBe(100000);
      expect(Number(crLine?.credit)).toBe(100000);
    });

    it('should create Asset journal for Positive Adjustment (Gain)', async () => {
      // Adjustment: +1. Cost @ 120,000 (New cost).
      const movement = await inventoryService.adjustStock(COMPANY_ID, {
        productId,
        quantity: 1, // Gain
        costPerUnit: 120000,
        reference: 'Gain Check',
      });

      const journals = await journalService.list(COMPANY_ID);
      // Fix: Look for the specific reference we passed
      const adjJournal = journals.find((j: any) => j.reference === 'Gain Check') as any;

      expect(adjJournal).toBeDefined();

      // Dr 1400 (Asset), Cr 5200 (Contra Expense/Revenue)
      const drLine = adjJournal.lines.find((l: any) => l.account.code === '1400');
      const crLine = adjJournal.lines.find((l: any) => l.account.code === '5200');

      expect(Number(drLine?.debit)).toBe(120000);
      expect(Number(crLine?.credit)).toBe(120000);
    });

    it('should block negative adjustment if insufficient stock', async () => {
      // Current Stock: 8 - 1 + 1 = 8.
      // Try to remove 10.
      await expect(
        inventoryService.adjustStock(COMPANY_ID, {
          productId,
          quantity: -10,
          costPerUnit: 0,
        })
      ).rejects.toThrow(/Insufficient stock/);
    });
  });

  describe('US3: Accounting Equation', () => {
    it('should maintain balanced debits and credits', async () => {
      const journals = await journalService.list(COMPANY_ID);
      for (const journal of journals) {
        const j = journal as any;
        const totalDebit = j.lines.reduce((sum: number, l: any) => sum + Number(l.debit), 0);
        const totalCredit = j.lines.reduce((sum: number, l: any) => sum + Number(l.credit), 0);
        expect(totalDebit).toBeCloseTo(totalCredit, 2);
      }
    });
  });
});
