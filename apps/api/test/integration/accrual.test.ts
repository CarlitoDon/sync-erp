import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma } from '@sync-erp/database';
import { BillService } from '@modules/accounting/services/bill.service';
import { JournalService } from '@modules/accounting/services/journal.service';
import { ProcurementService } from '@modules/procurement/procurement.service';
import { InventoryService } from '@modules/inventory/inventory.service';

const billService = new BillService();
const journalService = new JournalService();
const procurementService = new ProcurementService();
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
          type: acc.type as any,
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
    await prisma.journalEntry.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.invoice.deleteMany({
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

  it('should post GRNI journal on receipt and reverse it on Bill', async () => {
    // 1. Create Purchase Order
    // ProcurementService.create(companyId, data)
    const order = await procurementService.create(COMPANY_ID, {
      partnerId,
      items: [{ productId, quantity: 5, price: 100000 }],
      taxRate: 11,
    });
    const confirmedOrder = await procurementService.confirm(
      order.id,
      COMPANY_ID
    );

    // 2. Process Goods Receipt (Should trigger Accrual)
    // Value: 5 * 100,000 = 500,000
    await inventoryService.processGoodsReceipt(COMPANY_ID, {
      orderId: confirmedOrder.id,
      reference: 'GRN-001',
    });

    // 3. Verify Accrual Journal
    const journals = await journalService.list(COMPANY_ID);
    const grnJournal = journals.find(
      (j) => j.reference === 'GRN-001'
    );

    expect(grnJournal).toBeDefined();
    // Dr 1400 (Asset), Cr 2105 (Liability)
    // journalService.list returns includes?
    // JournalRepository.findAll includes lines and account.
    const grnAsset = (grnJournal as any).lines.find(
      (l: any) => l.account.code === '1400'
    );
    const grnLiab = (grnJournal as any).lines.find(
      (l: any) => l.account.code === '2105'
    );

    expect(Number(grnAsset?.debit)).toBe(500000);
    expect(Number(grnLiab?.credit)).toBe(500000);

    // 4. Create Bill
    // BillService.createFromPurchaseOrder(companyId, data)
    const bill = await billService.createFromPurchaseOrder(
      COMPANY_ID,
      {
        orderId: confirmedOrder.id,
        invoiceNumber: 'INV-SUP-001',
      }
    );

    expect(Number(bill.subtotal)).toBe(500000);
    expect(Number(bill.taxAmount)).toBe(55000); // 11% tax

    // 5. Post Bill (Should Offset Accrual)
    await billService.post(bill.id, COMPANY_ID);

    // 6. Verify Bill Journal
    const allJournals = await journalService.list(COMPANY_ID);
    const billJournal = allJournals.find((j) =>
      j.reference?.includes('INV-SUP-001')
    );

    expect(billJournal).toBeDefined();

    // Dr 2105 (Liability - Clearing Accrual), Dr 1500 (VAT), Cr 2100 (AP)
    const billAccrual = (billJournal as any).lines.find(
      (l: any) => l.account.code === '2105'
    );
    const billVat = (billJournal as any).lines.find(
      (l: any) => l.account.code === '1500'
    );
    const billAp = (billJournal as any).lines.find(
      (l: any) => l.account.code === '2100'
    );

    expect(Number(billAccrual?.debit)).toBe(500000); // Clears the Credit from GRN
    expect(Number(billVat?.debit)).toBe(55000);
    expect(Number(billAp?.credit)).toBe(555000);
  });
});
