import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma } from '@sync-erp/database';
import { BillService } from '@modules/accounting/services/bill.service';
import { JournalService } from '@modules/accounting/services/journal.service';
import { ProcurementService } from '@modules/procurement/procurement.service';
import { InventoryService } from '@modules/inventory/inventory.service';

const billService = new BillService();
const journalService = new JournalService();
const purchaseOrderService = new ProcurementService();
const inventoryService = new InventoryService();

const COMPANY_ID = 'test-tax-purchase-001';

describe('US2: Purchase Tax Selection (Input VAT)', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Tax Purchase Company' },
      update: {},
    });

    // 2. Setup Accounts
    const accounts = [
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' }, // Or Suspense
      { code: '1500', name: 'VAT Receivable', type: 'ASSET' }, // Input VAT
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
      {
        code: '2105',
        name: 'GRNI/Accrued Liability',
        type: 'LIABILITY',
      }, // Required for accrual
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

    // 3. Setup Partner (Supplier)
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Tax Supplier',
        type: 'SUPPLIER',
        email: `supplier-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // 4. Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `PURCH-PROD-${Date.now()}`,
        name: 'Purchase Product',
        price: 200000, // Sales price, irrelevant for PO cost?
        stockQty: 0,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup cascade
    await prisma.journalEntry.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.invoice.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    // Delete GRN first
    await prisma.goodsReceiptItem.deleteMany({
      where: { goodsReceipt: { companyId: COMPANY_ID } },
    });
    await prisma.goodsReceipt.deleteMany({
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

  it('should split Bill Journal into Inventory, VAT Receivable, and AP when Tax Rate is selected', async () => {
    // 1. Create Purchase Order with 11% Tax
    // Amount: 100,000 * 2 = 200,000.
    // Tax: 11%.
    const order = await purchaseOrderService.create(COMPANY_ID, {
      partnerId,
      items: [{ productId, quantity: 2, price: 100000 }],
      taxRate: 11,
    });

    const confirmedOrder = await purchaseOrderService.confirm(
      order.id,
      COMPANY_ID
    );

    // 2. Create and Post GRN (required before Bill creation)
    const grn = await inventoryService.createGRN(COMPANY_ID, {
      purchaseOrderId: confirmedOrder.id,
      notes: `GRN for Tax Test ${confirmedOrder.id}`,
      items: [{ productId, quantity: 2 }],
    });
    await inventoryService.postGRN(COMPANY_ID, grn.id);

    // 3. Create Bill
    const bill = await billService.createFromPurchaseOrder(
      COMPANY_ID,
      {
        orderId: confirmedOrder.id,
        invoiceNumber: `BILL-${Date.now()}`,
      }
    );

    expect(Number(bill.subtotal)).toBe(200000);
    expect(Number(bill.taxRate)).toBe(11);
    expect(Number(bill.taxAmount)).toBe(22000); // 200,000 * 0.11
    expect(Number(bill.amount)).toBe(222000);

    // 3. Post Bill -> Triggers Journal
    await billService.post(bill.id, COMPANY_ID);

    // 4. Verify Journal
    const journals = await journalService.list(COMPANY_ID);
    const billJournal = journals.find((j) =>
      j.reference?.includes(bill.invoiceNumber!)
    ) as any;

    expect(billJournal).toBeDefined();
    expect(billJournal.lines).toHaveLength(3); // GRNI, Input VAT, AP

    // Verify Lines - With accrual accounting: Dr GRNI (2105), Dr Input VAT (1500), Cr AP (2100)
    const grniLine = billJournal!.lines.find(
      (l: any) => l.account.code === '2105'
    );
    const vatLine = billJournal!.lines.find(
      (l: any) => l.account.code === '1500'
    );
    const apLine = billJournal!.lines.find(
      (l: any) => l.account.code === '2100'
    );

    expect(Number(grniLine?.debit)).toBe(200000); // Clear GRNI accrual (Net Cost)
    expect(Number(vatLine?.debit)).toBe(22000); // VAT Recoverable
    expect(Number(apLine?.credit)).toBe(222000); // Total Payable
  });

  it('should NOT record VAT Receivable if Tax Rate is 0', async () => {
    // 1. Create Purchase Order with 0% Tax
    const order = await purchaseOrderService.create(COMPANY_ID, {
      partnerId,
      items: [{ productId, quantity: 1, price: 100000 }],
      taxRate: 0,
    });
    const confirmedOrder = await purchaseOrderService.confirm(
      order.id,
      COMPANY_ID
    );

    // 2. Create and Post GRN (required before Bill creation)
    const grnZero = await inventoryService.createGRN(COMPANY_ID, {
      purchaseOrderId: confirmedOrder.id,
      notes: `GRN for Zero Tax Test ${confirmedOrder.id}`,
      items: [{ productId, quantity: 1 }],
    });
    await inventoryService.postGRN(COMPANY_ID, grnZero.id);

    // 3. Create Bill
    const bill = await billService.createFromPurchaseOrder(
      COMPANY_ID,
      {
        orderId: confirmedOrder.id,
      }
    );

    expect(Number(bill.taxAmount)).toBe(0);
    expect(Number(bill.amount)).toBe(100000);

    // 3. Post
    await billService.post(bill.id, COMPANY_ID);

    // 4. Verify Journal
    const journals = await journalService.list(COMPANY_ID);
    const billJournal = journals.find((j) =>
      j.reference?.includes(bill.invoiceNumber!)
    ) as any;

    expect(billJournal.lines).toHaveLength(2); // GRNI + AP only (no VAT)

    const vatLine = billJournal!.lines.find(
      (l: any) => l.account.code === '1500'
    );
    expect(vatLine).toBeUndefined();
  });
});
