import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma, JournalEntry } from '@sync-erp/database';
import { BillService } from '@modules/accounting/services/bill.service';
import { JournalService } from '@modules/accounting/services/journal.service';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';
import { InventoryService } from '@modules/inventory/inventory.service';


const billService = new BillService();
const journalService = new JournalService();
const procurementService = new PurchaseOrderService();
const inventoryService = new InventoryService();

const COMPANY_ID = 'test-accrual-001';

describe('US4: Goods Receipt Accrual (GRNI)', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Accrual Test Company' },
      update: {},
    });

    // 2. Setup Accounts
    const accounts = [
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
      { code: '2105', name: 'Unbilled Liability', type: 'LIABILITY' }, // Accrual
      { code: '1500', name: 'VAT Receivable', type: 'ASSET' },
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
          isActive: true, // Ensure active
        },
      });
    }

    // 3. Setup Product
    // Use upsert or delete/create to avoid unique constraint if test re-runs
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `ACCRUAL-PROD-${Date.now()}`,
        name: 'Accrual Product',
        price: 100000,
        stockQty: 0,
        averageCost: 0, // Ensure averageCost is init
      },
    });
    productId = product.id;

    // 4. Setup Partner
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Accrual Supplier',
        type: 'SUPPLIER',
        email: `accrual-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;
  });

  afterAll(async () => {
    // Cleanup cascade
    // Order matters for FK
    await prisma.journalLine.deleteMany({
      where: { account: { companyId: COMPANY_ID } },
    }); // Lines first if not cascade
    await prisma.payment.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.invoice.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    // Delete Fulfillments first
    await prisma.fulfillmentItem.deleteMany({
      where: { fulfillment: { companyId: COMPANY_ID } },
    });
    await prisma.fulfillment.deleteMany({
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

  it('should post GRNI journal on receipt and reverse it on Bill', async () => {
    // 1. Create Purchase Order
    // PurchaseOrderService.create(companyId, data)
    const order = await procurementService.create(COMPANY_ID, {
      partnerId,
      type: 'PURCHASE',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 5, price: 100000 }],
      taxRate: 11,
    });
    const confirmedOrder = await procurementService.confirm(
      order.id,
      COMPANY_ID,
      'test-user-id'
    );

    // 2. Create and Post GRN (Should trigger Accrual)
    // Value: 5 * 100,000 = 500,000
    const grn = await inventoryService.createGRN(COMPANY_ID, {
      purchaseOrderId: confirmedOrder.id,
      notes: `GRN-001 ${confirmedOrder.id}`,
      items: [{ productId, quantity: 5 }],
    });
    await inventoryService.postGRN(COMPANY_ID, grn.id);

    // 3. Verify Accrual Journal
    const journals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    });
    const grnJournal = journals.find((j) =>
      j.reference?.includes('GRN')
    );

    expect(grnJournal).toBeDefined();
    // Dr 1400 (Asset), Cr 2105 (Liability)
    // journalService.list returns includes?
    // JournalRepository.findAll includes lines and account.
    const grnAsset = grnJournal!.lines.find(
      (l) => l.account.code === '1400'
    );
    const grnLiab = grnJournal!.lines.find(
      (l) => l.account.code === '2105'
    );

    expect(Number(grnAsset?.debit)).toBe(500000);
    expect(Number(grnLiab?.credit)).toBe(500000);

    // 4. Create Bill
    // BillService.createFromPurchaseOrder(companyId, data)
    const bill = await billService.createFromPurchaseOrder(
      COMPANY_ID,
      {
        orderId: confirmedOrder.id,
        supplierInvoiceNumber: 'FKT/SUP/001', // External reference from supplier
      }
    );

    expect(Number(bill.subtotal)).toBe(500000);
    expect(Number(bill.taxAmount)).toBe(55000); // 11% tax

    // 5. Post Bill (Should Offset Accrual)
    await billService.post(bill.id, COMPANY_ID);

    // 6. Verify Bill Journal (search by sourceType and sourceId)
    const allJournals = await journalService.list(COMPANY_ID);
    const billJournal = allJournals.find(
      (j: JournalEntry) => j.sourceType === 'BILL' && j.sourceId === bill.id
    );

    expect(billJournal).toBeDefined();

    // Dr 2105 (Liability - Clearing Accrual), Dr 1500 (VAT), Cr 2100 (AP)
    const billAccrual = billJournal!.lines.find(
      (l) => l.account.code === '2105'
    );
    const billVat = billJournal!.lines.find(
      (l) => l.account.code === '1500'
    );
    const billAp = billJournal!.lines.find(
      (l) => l.account.code === '2100'
    );

    expect(Number(billAccrual?.debit)).toBe(500000); // Clears the Credit from GRN
    expect(Number(billVat?.debit)).toBe(55000);
    expect(Number(billAp?.credit)).toBe(555000);
  });
  describe('Edge Cases', () => {
    it('Should fail to post an already posted GRN', async () => {
      // Create PO
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: 'NET30',
        items: [{ productId, quantity: 1, price: 100000 }],
        taxRate: 11,
      });
      const confirmedOrder = await procurementService.confirm(
        order.id,
        COMPANY_ID,
        'test-user-id'
      );

      // Create GRN
      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: confirmedOrder.id,
        items: [{ productId, quantity: 1 }],
      });

      // Post once
      await inventoryService.postGRN(COMPANY_ID, grn.id);

      // Post again
      await expect(
        inventoryService.postGRN(COMPANY_ID, grn.id)
      ).rejects.toThrow();
    });

    it('Should fail to create Bill for unreceived PO (Accrual Check)', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: 'NET30',
        items: [{ productId, quantity: 1, price: 100000 }],
      });
      const confirmedOrder = await procurementService.confirm(
        order.id,
        COMPANY_ID,
        'test-user-id'
      );

      // Try to create bill without GRN
      await expect(
        billService.createFromPurchaseOrder(COMPANY_ID, {
          orderId: confirmedOrder.id,
        })
      ).rejects.toThrow(/goods.*received/i);
    });
  });
});
