import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma } from '@sync-erp/database';
import { InventoryService } from '@modules/inventory/inventory.service';
import { SalesOrderService } from '@modules/sales/sales-order.service';


const inventoryService = new InventoryService();
const salesOrderService = new SalesOrderService();

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
    // Cleanup - order matters due to foreign key constraints
    const deleteJournals = prisma.journalEntry.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deleteMovements = prisma.inventoryMovement.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deleteFulfillmentItems = prisma.fulfillmentItem.deleteMany({
      where: { fulfillment: { companyId: COMPANY_ID } },
    });
    const deleteFulfillments = prisma.fulfillment.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deleteOrderItems = prisma.orderItem.deleteMany({
      where: { order: { companyId: COMPANY_ID } },
    });
    const deleteOrders = prisma.order.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deleteProducts = prisma.product.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deleteAccounts = prisma.account.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deletePartners = prisma.partner.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deleteCompany = prisma.company.delete({
      where: { id: COMPANY_ID },
    });

    await prisma.$transaction([
      deleteJournals,
      deleteMovements,
      deleteFulfillmentItems,
      deleteFulfillments,
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

      // 2. Process Shipment using SalesOrderService.ship (Cost = 2 * 100,000 = 200,000)
      await salesOrderService.ship(COMPANY_ID, order.id);

      // 3. Verify Journal - look for shipment journal by sourceType
      const journals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    });
      const shipmentJournal = journals.find(
        (j) =>
          j.reference?.includes('SHP:')
      );

      expect(shipmentJournal).toBeDefined();
      expect(shipmentJournal!.lines).toHaveLength(2);

      const drLine = shipmentJournal!.lines.find(
        (l) => l.account.code === '5000'
      );
      const crLine = shipmentJournal!.lines.find(
        (l) => l.account.code === '1400'
      );

      expect(Number(drLine!.debit)).toBe(200000);
      expect(Number(crLine!.credit)).toBe(200000);
    });
  });

  describe('US2: Stock Adjustment', () => {
    it('should create Expense journal for Negative Adjustment (Loss)', async () => {
      // Initial Stock: 10 - 2 (shipped) = 8.
      // Adjustment: -1. Cost @ 100,000.
      await inventoryService.adjustStock(COMPANY_ID, {
        productId,
        quantity: -1, // Loss
        costPerUnit: 0, // Ignored for loss
        reference: 'Loss Check',
      });

      const journals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    });
      // Fix: Look for the specific reference we passed
      const adjJournal = journals.find(
        (j) => j.reference === 'Loss Check'
      );

      expect(adjJournal).toBeDefined();
      expect(adjJournal!.lines).toHaveLength(2);

      // Dr 5200 (Expense), Cr 1400 (Asset)
      const drLine = adjJournal!.lines.find(
        (l) => l.account.code === '5200'
      );
      const crLine = adjJournal!.lines.find(
        (l) => l.account.code === '1400'
      );

      expect(Number(drLine!.debit)).toBe(100000);
      expect(Number(crLine!.credit)).toBe(100000);
    });

    it('should create Asset journal for Positive Adjustment (Gain)', async () => {
      // Adjustment: +1. Cost @ 120,000 (New cost).
      await inventoryService.adjustStock(COMPANY_ID, {
        productId,
        quantity: 1, // Gain
        costPerUnit: 120000,
        reference: 'Gain Check',
      });

      const journals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    });
      // Fix: Look for the specific reference we passed
      const adjJournal = journals.find(
        (j) => j.reference === 'Gain Check'
      );

      expect(adjJournal).toBeDefined();

      // Dr 1400 (Asset), Cr 5200 (Contra Expense/Revenue)
      const drLine = adjJournal!.lines.find(
        (l) => l.account.code === '1400'
      );
      const crLine = adjJournal!.lines.find(
        (l) => l.account.code === '5200'
      );

      expect(Number(drLine!.debit)).toBe(120000);
      expect(Number(crLine!.credit)).toBe(120000);
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
      const journals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    });
      for (const journal of journals) {
        const j = journal!;
        const totalDebit = j.lines.reduce(
          (sum: number, l) => sum + Number(l.debit),
          0
        );
        const totalCredit = j.lines.reduce(
          (sum: number, l) => sum + Number(l.credit),
          0
        );
        expect(totalDebit).toBeCloseTo(totalCredit, 2);
      }
    });
  });
});
