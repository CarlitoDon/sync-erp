import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@sync-erp/database';
import { InventoryService } from '../../src/services/InventoryService';
import { JournalService } from '../../src/services/JournalService';
import { FulfillmentService } from '../../src/services/FulfillmentService';
import { BillService } from '../../src/services/BillService';
import { InvoiceService } from '../../src/services/InvoiceService';
import { PaymentService } from '../../src/services/PaymentService';
import { PurchaseOrderService } from '../../src/services/PurchaseOrderService';
import { SalesOrderService } from '../../src/services/SalesOrderService';

// Initialize Services
const inventoryService = new InventoryService();
const journalService = new JournalService();
const fulfillmentService = new FulfillmentService();
const billService = new BillService();
const invoiceService = new InvoiceService();
const paymentService = new PaymentService();
const purchaseOrderService = new PurchaseOrderService();
const salesOrderService = new SalesOrderService();

const COMPANY_ID = 'test-e2e-finance-cycle-001';
const USER_ID = 'test-user-001'; // Mock user

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
      { code: '4100', name: 'Sales Revenue', type: 'REVENUE' },
      { code: '5000', name: 'COGS', type: 'EXPENSE' },
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
    const deleteJournals = prisma.journalEntry.deleteMany({ where: { companyId: COMPANY_ID } });
    const deleteMovements = prisma.inventoryMovement.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    const deletePayments = prisma.payment.deleteMany({
      where: { invoice: { companyId: COMPANY_ID } },
    });
    const deleteInvoices = prisma.invoice.deleteMany({ where: { companyId: COMPANY_ID } });
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
      const order = await purchaseOrderService.create(COMPANY_ID, USER_ID, {
        partnerId: supplierId,
        items: [{ productId, quantity: 10, price: 100 }], // Cost 100 * 10 = 1000
      });
      orderId = order.id;
      expect(order.status).toBe('DRAFT');

      // Confirm PO
      await purchaseOrderService.confirm(order.id, COMPANY_ID);
    });

    it('2. Should Receive Goods (Updates Stock, No Journal yet)', async () => {
      // Process goods receipt
      await inventoryService.processGoodsReceipt(COMPANY_ID, {
        orderId,
        reference: 'GRN-001',
      });

      // Check Stock using Service (or Prisma)
      const prod = await prisma.product.findUnique({ where: { id: productId } });
      expect(prod?.stockQty).toBe(10);
      expect(Number(prod?.averageCost)).toBe(100);

      // Verify NO Journal yet (depending on current logic, Goods Receipt might not trigger one)
      const journals = await journalService.list(COMPANY_ID);
      const grnJournal = journals.find((j: any) => j.reference === 'GRN-001');
      expect(grnJournal).toBeUndefined(); // Standard behavior as per implementation analysis
    });

    it('3. Should Create and Post Bill (Dr Inventory 1400, Cr AP 2100)', async () => {
      // Create Bill from PO
      const bill = await billService.createFromPurchaseOrder(COMPANY_ID, USER_ID, {
        orderId,
        invoiceNumber: 'BILL-001',
      });
      billId = bill.id;

      // Post Bill
      await billService.post(bill.id, COMPANY_ID);

      const journals = await journalService.list(COMPANY_ID);
      const billJournal = journals.find((j: any) => j.reference === 'Bill: BILL-001') as any;

      expect(billJournal).toBeDefined();
      const drLine = billJournal.lines.find((l: any) => l.account.code === '1400'); // Asset
      const crLine = billJournal.lines.find((l: any) => l.account.code === '2100'); // Liability

      expect(Number(drLine.debit)).toBe(1000);
      expect(Number(crLine.credit)).toBe(1000);
    });

    it('4. Should Pay Bill (Dr AP 2100, Cr Cash 1100)', async () => {
      await paymentService.create(COMPANY_ID, {
        invoiceId: billId,
        amount: 1000,
        method: 'CASH',
      });

      const journals = await journalService.list(COMPANY_ID);
      const payJournal = journals.find((j: any) => j.reference === 'Payment made: BILL-001') as any;

      expect(payJournal).toBeDefined();
      const drLine = payJournal.lines.find((l: any) => l.account.code === '2100'); // Liability Decrease
      const crLine = payJournal.lines.find((l: any) => l.account.code === '1100'); // Asset Decrease

      expect(Number(drLine.debit)).toBe(1000);
      expect(Number(crLine.credit)).toBe(1000);
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
      const order = await salesOrderService.create(COMPANY_ID, USER_ID, {
        partnerId: customerId,
        items: [{ productId, quantity: 5, price: 200 }], // Sell 5 @ 200. Cost is 100.
      });
      orderId = order.id;

      await salesOrderService.confirm(order.id, COMPANY_ID);
    });

    it('2. Should Ship Goods (Dr COGS 5000, Cr Inventory 1400)', async () => {
      // Get Order Number for reference check
      const order = await prisma.order.findUnique({ where: { id: orderId } });

      await fulfillmentService.processShipment(COMPANY_ID, { orderId });

      // Check Stock
      const prod = await prisma.product.findUnique({ where: { id: productId } });
      expect(prod?.stockQty).toBe(5); // 10 - 5

      // Check Journal
      const journals = await journalService.list(COMPANY_ID);
      const shipJournal = journals.find((j: any) =>
        j.reference?.includes(`Shipment for Order ${order?.orderNumber}`)
      ) as any;

      expect(shipJournal).toBeDefined();
      // Cost = 5 * 100 = 500
      const drLine = shipJournal.lines.find((l: any) => l.account.code === '5000'); // Expense
      const crLine = shipJournal.lines.find((l: any) => l.account.code === '1400'); // Asset

      expect(Number(drLine.debit)).toBe(500);
      expect(Number(crLine.credit)).toBe(500);
    });

    it('3. Should Create and Post Invoice (Dr AR 1300, Cr Revenue 4100)', async () => {
      const invoice = await invoiceService.createFromSalesOrder(COMPANY_ID, USER_ID, {
        orderId,
        invoiceNumber: 'INV-001',
      });
      invoiceId = invoice.id;

      await invoiceService.post(invoiceId, COMPANY_ID);

      const journals = await journalService.list(COMPANY_ID);
      const invJournal = journals.find((j: any) => j.reference === 'Invoice: INV-001') as any;

      expect(invJournal).toBeDefined();
      // Revenue = 5 * 200 = 1000
      const drLine = invJournal.lines.find((l: any) => l.account.code === '1300'); // Asset (AR)
      const crLine = invJournal.lines.find((l: any) => l.account.code === '4100'); // Revenue

      expect(Number(drLine.debit)).toBe(1000);
      expect(Number(crLine.credit)).toBe(1000);
    });

    it('4. Should Receive Payment (Dr Cash 1100, Cr AR 1300)', async () => {
      await paymentService.create(COMPANY_ID, {
        invoiceId,
        amount: 1000,
        method: 'CASH',
      });

      const journals = await journalService.list(COMPANY_ID);
      const payJournal = journals.find(
        (j: any) => j.reference === 'Payment received: INV-001'
      ) as any;

      expect(payJournal).toBeDefined();
      const drLine = payJournal.lines.find((l: any) => l.account.code === '1100'); // Asset (Cash)
      const crLine = payJournal.lines.find((l: any) => l.account.code === '1300'); // Asset Decrease (AR)

      expect(Number(drLine.debit)).toBe(1000);
      expect(Number(crLine.credit)).toBe(1000);
    });
  });
});
