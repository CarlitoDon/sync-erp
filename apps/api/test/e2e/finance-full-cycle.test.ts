import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma } from '@sync-erp/database';
import { InventoryService } from '@modules/inventory/inventory.service';
import { BillService } from '@modules/accounting/services/bill.service';
import { InvoiceService } from '@modules/accounting/services/invoice.service';
import { PaymentService } from '@modules/accounting/services/payment.service';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';
import { SalesOrderService } from '@modules/sales/sales-order.service';


// Initialize Services
const inventoryService = new InventoryService();
const salesOrderService = new SalesOrderService();
const invoiceService = new InvoiceService();
const paymentService = new PaymentService();
const purchaseOrderService = new PurchaseOrderService();
const billService = new BillService();

const COMPANY_ID = 'test-e2e-finance-cycle-001';

describe('E2E Finance Cycle: Procure-to-Pay & Order-to-Cash', () => {
  let productId: string;
  let supplierId: string;
  let customerId: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'E2E Finance Test Corp' },
      update: {},
    });

    // 2. Setup Accounts (Standard CoA)
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
      {
        code: '2105',
        name: 'GRNI/Accrued Liability',
        type: 'LIABILITY',
      }, // Required for accrual
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

    // 3. Setup Partners
    const supplier = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'E2E Supplier',
        type: 'SUPPLIER',
        email: 'sup@test.com',
      },
    });
    supplierId = supplier.id;

    const customer = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'E2E Customer',
        type: 'CUSTOMER',
        email: 'cust@test.com',
      },
    });
    customerId = customer.id;

    // 4. Setup Product (Initially 0 stock)
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `E2E-PROD-${Date.now()}`,
        name: 'E2E Widget',
        price: 200, // Sales Price
        averageCost: 0,
        stockQty: 0,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup
    const deleteJournals = prisma.journalEntry.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deleteMovements = prisma.inventoryMovement.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deletePayments = prisma.payment.deleteMany({
      where: { invoice: { companyId: COMPANY_ID } },
    });
    const deleteFulfillmentItems = prisma.fulfillmentItem.deleteMany({
      where: { fulfillment: { companyId: COMPANY_ID } },
    });
    const deleteFulfillments = prisma.fulfillment.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deleteInvoices = prisma.invoice.deleteMany({
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
      deletePayments, // Payments first because of FK
      deleteInvoices,
      deleteOrderItems,
      deleteOrders,
      deleteProducts,
      deleteAccounts,
      deletePartners,
      deleteCompany,
    ]);
  });

  // ==========================================
  // SCENARIO 1: PROCURE TO PAY
  // Flow: PO -> Receive Goods -> Bill -> Pay Bill
  // Checks: Stock Increase, Journals (Bill: Dr Inv/Cr AP, Pay: Dr AP/Cr Cash)
  // ==========================================
  describe('Procure to Pay Cycle', () => {
    let orderId: string;
    let billId: string;

    it('1. Should create Purchase Order', async () => {
      const order = await purchaseOrderService.create(COMPANY_ID, {
        partnerId: supplierId,
        type: 'PURCHASE',
        paymentTerms: 'NET30',
        items: [{ productId, quantity: 10, price: 100 }], // Cost 100 * 10 = 1000
      });
      orderId = order.id;
      expect(order.status).toBe('DRAFT');

      // Confirm PO
      await purchaseOrderService.confirm(
        order.id,
        COMPANY_ID,
        'test-user-id'
      );
    });

    it('2. Should Receive Goods (Updates Stock, Creates GRNI Accrual Journal)', async () => {
      // Create and Post GRN
      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: orderId,
        notes: `GRN-001 ${orderId}`,
        items: [{ productId, quantity: 10 }],
      });
      await inventoryService.postGRN(COMPANY_ID, grn.id);

      // Check Stock using Service (or Prisma)
      const prod = await prisma.product.findUnique({
        where: { id: productId },
      });
      expect(prod?.stockQty).toBe(10);
      expect(Number(prod?.averageCost)).toBe(100);

      // Verify GRNI Accrual Journal exists (Dr Inventory, Cr GRNI)
      const journals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    });
      const grnJournal = journals.find((j) =>
        j.reference?.includes('GRN')
      );
      expect(grnJournal).toBeDefined();

      // Verify the journal lines (Dr 1400 Inventory, Cr 2105 GRNI)
      const drLine = grnJournal!.lines.find(
        (l) => l.account.code === '1400'
      );
      const crLine = grnJournal!.lines.find(
        (l) => l.account.code === '2105'
      );
      expect(Number(drLine!.debit)).toBe(1000); // 10 * 100
      expect(Number(crLine!.credit)).toBe(1000);
    });

    it('3. Should Create and Post Bill (Dr GRNI 2105, Cr AP 2100)', async () => {
      // Create Bill from PO
      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId,
          supplierInvoiceNumber: 'FKT/001', // External reference
        }
      );
      billId = bill.id;

      // Post Bill
      await billService.post(bill.id, COMPANY_ID);

      const journals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    });
      // Use flexible matching - journal reference includes "Bill:"
      const billJournal = journals.find(
        (j) =>
          j.reference?.includes('Bill:') &&
          !j.reference?.includes('Reversal')
      );

      expect(billJournal).toBeDefined();
      // Bill should clear GRNI accrual (Dr 2105) and record AP (Cr 2100)
      const drLine = billJournal!.lines.find(
        (l) => l.account.code === '2105'
      ); // Clear GRNI
      const crLine = billJournal!.lines.find(
        (l) => l.account.code === '2100'
      ); // Liability AP

      expect(Number(drLine!.debit)).toBe(1000);
      expect(Number(crLine!.credit)).toBe(1000);
    });

    it('4. Should Pay Bill (Dr AP 2100, Cr Cash 1100)', async () => {
      await paymentService.create(COMPANY_ID, {
        invoiceId: billId,
        amount: 1000,
        method: 'CASH',
      });

      const journals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    });
      // Use flexible matching - journal reference includes "Payment made:"
      const payJournal = journals.find((j) =>
        j.reference?.includes('Payment made:')
      );

      expect(payJournal).toBeDefined();
      const drLine = payJournal!.lines.find(
        (l) => l.account.code === '2100'
      ); // Liability Decrease
      const crLine = payJournal!.lines.find(
        (l) => l.account.code === '1100'
      ); // Asset Decrease

      expect(Number(drLine!.debit)).toBe(1000);
      expect(Number(crLine!.credit)).toBe(1000);
    });
  });

  // ==========================================
  // SCENARIO 2: ORDER TO CASH
  // Flow: SO -> Ship Goods -> Invoice -> Receive Payment
  // Checks: Stock Decrease, Journals (Ship: Dr COGS/Cr Inv, Inv: Dr AR/Cr Rev, Pay: Dr Cash/Cr AR)
  // ==========================================
  describe('Order to Cash Cycle', () => {
    let orderId: string;
    let invoiceId: string;

    it('1. Should create Sales Order', async () => {
      const order = await salesOrderService.create(COMPANY_ID, {
        partnerId: customerId,
        type: 'SALES',
        items: [{ productId, quantity: 5, price: 200 }], // Sell 5 @ 200. Cost is 100.
      });
      orderId = order.id;

      await salesOrderService.confirm(order.id, COMPANY_ID);
    });

    it('2. Should Ship Goods (Dr COGS 5000, Cr Inventory 1400)', async () => {
      // Get Order Number for reference check

      await salesOrderService.ship(COMPANY_ID, orderId);

      // Check Stock
      const prod = await prisma.product.findUnique({
        where: { id: productId },
      });
      expect(prod?.stockQty).toBe(5); // 10 - 5

      // Check Journal
      const journals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    });
      const shipJournal = journals.find((j) =>
        j.reference?.includes('SHP')
      );

      expect(shipJournal).toBeDefined();
      // Cost = 5 * 100 = 500
      const drLine = shipJournal!.lines.find(
        (l) => l.account.code === '5000'
      ); // Expense
      const crLine = shipJournal!.lines.find(
        (l) => l.account.code === '1400'
      ); // Asset

      expect(Number(drLine!.debit)).toBe(500);
      expect(Number(crLine!.credit)).toBe(500);
    });

    it('3. Should Create and Post Invoice (Dr AR 1300, Cr Revenue 4100)', async () => {
      const invoice = await invoiceService.createFromSalesOrder(
        COMPANY_ID,
        {
          orderId,
          invoiceNumber: 'INV-001',
        }
      );
      invoiceId = invoice.id;

      await invoiceService.post(invoiceId, COMPANY_ID);

      const journals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    });
      // Use flexible matching - journal reference includes "Invoice:"
      const invJournal = journals.find(
        (j) =>
          j.reference?.includes('Invoice:') &&
          !j.reference?.includes('Reversal')
      );

      expect(invJournal).toBeDefined();
      // Revenue = 5 * 200 = 1000
      const drLine = invJournal!.lines.find(
        (l) => l.account.code === '1300'
      ); // Asset (AR)
      const crLine = invJournal!.lines.find(
        (l) => l.account.code === '4100'
      ); // Revenue

      expect(Number(drLine!.debit)).toBe(1000);
      expect(Number(crLine!.credit)).toBe(1000);
    });

    it('4. Should Receive Payment (Dr Cash 1100, Cr AR 1300)', async () => {
      await paymentService.create(COMPANY_ID, {
        invoiceId,
        amount: 1000,
        method: 'CASH',
      });

      const journals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    });
      // Use flexible matching - journal reference includes "Payment received:"
      const payJournal = journals.find((j) =>
        j.reference?.includes('Payment received:')
      );

      expect(payJournal).toBeDefined();
      const drLine = payJournal!.lines.find(
        (l) => l.account.code === '1100'
      ); // Asset (Cash)
      const crLine = payJournal!.lines.find(
        (l) => l.account.code === '1300'
      ); // Asset Decrease (AR)

      expect(Number(drLine!.debit)).toBe(1000);
      expect(Number(crLine!.credit)).toBe(1000);
    });
  });
});
