import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma } from '@sync-erp/database';
import { SalesOrderService } from '@modules/sales/sales-order.service';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';
import { InvoiceService } from '@modules/accounting/services/invoice.service';
import { BillService } from '@modules/accounting/services/bill.service';
import { JournalService } from '@modules/accounting/services/journal.service';
import { InventoryService } from '@modules/inventory/inventory.service';

// Initialize Services
const salesOrderService = new SalesOrderService();
const purchaseOrderService = new PurchaseOrderService();
const invoiceService = new InvoiceService();
const billService = new BillService();
const journalService = new JournalService();
const inventoryService = new InventoryService();

const COMPANY_ID = 'e2e-tax-cycle-001';

describe('E2E: Finance Tax, Returns & Accruals Cycle', () => {
  let productId: string;
  let customerId: string;
  let supplierId: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'E2E Tax Company' },
      update: {},
    });

    // 2. Setup Accounts
    const accounts = [
      { code: '1300', name: 'AR', type: 'ASSET' },
      { code: '2100', name: 'AP', type: 'LIABILITY' },
      { code: '4100', name: 'Revenue', type: 'REVENUE' },
      { code: '5000', name: 'COGS', type: 'EXPENSE' },
      { code: '1400', name: 'Inventory', type: 'ASSET' },
      { code: '2300', name: 'VAT Payable', type: 'LIABILITY' },
      { code: '1500', name: 'VAT Receivable', type: 'ASSET' },
      { code: '2105', name: 'Unbilled Liability', type: 'LIABILITY' },
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

    // 3. Setup Partners
    const customer = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'E2E Customer',
        type: 'CUSTOMER',
        email: `cust-${Date.now()}@test.com`,
      },
    });
    customerId = customer.id;

    const supplier = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'E2E Supplier',
        type: 'SUPPLIER',
        email: `supp-${Date.now()}@test.com`,
      },
    });
    supplierId = supplier.id;

    // 4. Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `E2E-PROD-${Date.now()}`,
        name: 'E2E Tax Product',
        price: 200000,
        stockQty: 0,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup
    const deleteJournal = prisma.journalEntry.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deleteInvMov = prisma.inventoryMovement.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deleteFulfillmentItems = prisma.fulfillmentItem.deleteMany({
      where: { fulfillment: { companyId: COMPANY_ID } },
    });
    const deleteFulfillments = prisma.fulfillment.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deleteInvoice = prisma.invoice.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deleteItems = prisma.orderItem.deleteMany({
      where: { order: { companyId: COMPANY_ID } },
    });
    const deleteOrders = prisma.order.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deleteProd = prisma.product.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deleteAcc = prisma.account.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deletePartner = prisma.partner.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deleteComp = prisma.company.delete({
      where: { id: COMPANY_ID },
    });

    await prisma.$transaction([
      deleteJournal,
      deleteInvMov,
      deleteFulfillmentItems,
      deleteFulfillments,
      deleteInvoice,
      deleteItems,
      deleteOrders,
      deleteProd,
      deleteAcc,
      deletePartner,
      deleteComp,
    ]);
  });

  it('Flow 2: Purchase Cycle (Input VAT & Accrual)', async () => {
    // 1. Create Purchase Order (11% Tax)
    const po = await purchaseOrderService.create(COMPANY_ID, {
      partnerId: supplierId,
      type: 'PURCHASE',
      paymentTerms: 'NET30',
      items: [{ productId, quantity: 10, price: 100000 }],
      taxRate: 11,
    });
    const confirmedPO = await purchaseOrderService.confirm(
      po.id,
      COMPANY_ID,
      'test-user-id'
    );

    // 2. Goods Receipt -> Accrual
    const grn = await inventoryService.createGRN(COMPANY_ID, {
      purchaseOrderId: confirmedPO.id,
      notes: `GRN-E2E-001 ${confirmedPO.id}`,
      items: [{ productId, quantity: 10 }],
    });
    await inventoryService.postGRN(COMPANY_ID, grn.id);

    // Check Accrual Journal
    const journals = await journalService.list(COMPANY_ID);
    const grnJournal = journals.find((j) =>
      j.reference?.includes('GRN')
    );
    expect(grnJournal).toBeDefined(); // Dr Inventory, Cr 2105 (1,000,000)

    // 3. Bill Creation -> Offset Accrual + Input VAT
    const bill = await billService.createFromPurchaseOrder(
      COMPANY_ID,
      {
        orderId: confirmedPO.id,
        supplierInvoiceNumber: 'FKT/E2E/001', // External reference from supplier
      }
    );
    expect(Number(bill.taxAmount)).toBe(110000); // 1,000,000 * 11%

    await billService.post(bill.id, COMPANY_ID);

    // Check Bill Journal (search by sourceType and sourceId)
    const allJournals = await journalService.list(COMPANY_ID);
    const billJournal = allJournals.find(
      (j) => j.sourceType === 'BILL' && j.sourceId === bill.id
    ) as any;
    expect(billJournal).toBeDefined();

    // Validate lines: Dr 2105 1M, Dr 1500 110k, Cr 2100 1.11M
    const drAccrual = billJournal.lines.find(
      (l: any) => l.account.code === '2105' && Number(l.debit) > 0
    );
    const drVat = billJournal.lines.find(
      (l: any) => l.account.code === '1500'
    );
    expect(drAccrual).toBeDefined();
    expect(Number(drVat?.debit)).toBe(110000);
  });

  it('Flow 1: Sales Cycle (Output VAT)', async () => {
    // 1. Create Sales Order
    const order = await salesOrderService.create(COMPANY_ID, {
      partnerId: customerId,
      type: 'SALES',
      items: [{ productId, quantity: 5, price: 200000 }], // 1M total
      taxRate: 11,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'CONFIRMED' },
    });

    // 2. Invoice
    const invoice = await invoiceService.createFromSalesOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        invoiceNumber: 'INV-E2E-001',
      }
    );
    expect(Number(invoice.taxAmount)).toBe(110000);

    await invoiceService.post(invoice.id, COMPANY_ID);

    // 3. Verify Sales Journal
    const journals = await journalService.list(COMPANY_ID);
    const salesJournal = journals.find((j) =>
      j.reference?.includes('INV-E2E-001')
    ) as any;

    // Dr AR 1.11M, Cr Rev 1M, Cr Tax 110k
    const crTax = salesJournal.lines.find(
      (l: any) => l.account.code === '2300'
    );
    expect(Number(crTax?.credit)).toBe(110000);
  });

  it.skip('Flow 3: Sales Return (COGS Reversal)', async () => {
    // 1. Ship Sales Order items first (to create Cost)
    // Find the SO from previous test
    const orders = await salesOrderService.list(COMPANY_ID);
    const so = orders.find((o) => o.orderNumber?.startsWith('SO-')); // Only 1 so far
    if (!so) throw new Error('SO missing');

    await salesOrderService.ship(COMPANY_ID, so.id);

    // 2. Return 1 item
    /* await salesOrderService.returnOrder(COMPANY_ID, so.id, [
      { productId, quantity: 1 },
    ]); */

    // 3. Verify Return Journal
    const journals = await journalService.list(COMPANY_ID);
    const returnJournal = journals.find((j) =>
      j.reference?.includes(`Return for order ${so.orderNumber}`)
    ) as any;

    // Dr Inventory, Cr COGS
    expect(returnJournal).toBeDefined();
    const drInv = returnJournal.lines.find(
      (l: any) => l.account.code === '1400'
    );
    expect(Number(drInv?.debit)).toBeGreaterThan(0);
  });
});
