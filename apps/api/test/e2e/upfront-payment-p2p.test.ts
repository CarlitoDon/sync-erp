/**
 * Feature 036: Cash Upfront Payment - Full P2P E2E Test (Canonical Flow)
 *
 * Complete Procure-to-Pay flow with upfront payment:
 * 1. Create PO with UPFRONT terms
 * 2. Confirm PO
 * 3. Register upfront payment (Dr 1600 Cr Bank)
 * 4. Receive goods via GRN (Dr 1400 Cr 2105) - SAME AS NORMAL
 * 5. Create & Post Bill (Dr 2105 Cr 2100) + AUTO SETTLE (Dr 2100 Cr 1600)
 * 6. Verify all balances: Advances=0, AP=0, Inventory=+X
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  OrderStatus,
  PaymentTerms,
  PaymentStatus,
  InvoiceStatus,
} from '@sync-erp/database';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';
import { UpfrontPaymentService } from '@modules/procurement/upfront-payment.service';
import { InventoryService } from '@modules/inventory/inventory.service';
import { BillService } from '@modules/accounting/services/bill.service';

const procurementService = new PurchaseOrderService();
const upfrontPaymentService = new UpfrontPaymentService();
const inventoryService = new InventoryService();
const billService = new BillService();

const COMPANY_ID = 'test-e2e-canonical-001';
const ACTOR_ID = 'test-user-001';

describe('Feature 036: Canonical P2P Cash Upfront Flow', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'E2E Canonical Upfront Test Company',
      },
      update: {},
    });

    // 2. Setup All Required Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '1500', name: 'VAT Receivable', type: 'ASSET' },
      { code: '1600', name: 'Advances to Supplier', type: 'ASSET' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
      { code: '2105', name: 'GRN Clearing', type: 'LIABILITY' },
      { code: '2300', name: 'VAT Payable', type: 'LIABILITY' },
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

    // 3. Setup Supplier
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'E2E Canonical Supplier',
        type: 'SUPPLIER',
        email: `canonical-e2e-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // 4. Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `E2E-CANONICAL-${Date.now()}`,
        name: 'E2E Canonical Test Product',
        price: 100000,
        averageCost: 80000,
        stockQty: 0,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.$transaction([
      prisma.auditLog.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN (SELECT id FROM "JournalEntry" WHERE "companyId" = ${COMPANY_ID})`,
      prisma.journalEntry.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.payment.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.invoice.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.inventoryMovement.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.fulfillmentItem.deleteMany({
        where: { fulfillment: { companyId: COMPANY_ID } },
      }),
      prisma.fulfillment.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.orderItem.deleteMany({
        where: { order: { companyId: COMPANY_ID } },
      }),
      prisma.order.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.product.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.account.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.delete({ where: { id: COMPANY_ID } }),
    ]);
  });

  it('Canonical Flow: PO → Pay → GRN → Bill (Auto Settle)', async () => {
    // ===========================================
    // STEP 1: Create PO with UPFRONT payment terms
    // ===========================================
    const order = await procurementService.create(COMPANY_ID, {
      partnerId,
      type: 'PURCHASE',
      items: [{ productId, quantity: 10, price: 100000 }],
      paymentTerms: 'UPFRONT',
    });

    expect(order.status).toBe(OrderStatus.DRAFT);
    expect(order.paymentTerms).toBe(PaymentTerms.UPFRONT);
    expect(order.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(Number(order.totalAmount)).toBe(1000000); // 10 x 100,000

    console.log('✓ Step 1: Created PO with UPFRONT terms');

    // ===========================================
    // STEP 2: Confirm PO
    // ===========================================
    const confirmedOrder = await procurementService.confirm(
      order.id,
      COMPANY_ID,
      ACTOR_ID
    );

    expect(confirmedOrder.status).toBe(OrderStatus.CONFIRMED);

    console.log('✓ Step 2: PO confirmed');

    // ===========================================
    // STEP 3: Register Upfront Payment
    // Journal: Dr 1600 (Advances to Supplier) Cr 1200 (Bank)
    // ===========================================
    const payment = await upfrontPaymentService.registerPayment(
      COMPANY_ID,
      {
        orderId: order.id,
        amount: 1000000,
        method: 'BANK',
        reference: 'E2E-TRF-001',
      },
      ACTOR_ID
    );

    expect(Number(payment.amount)).toBe(1000000);
    expect(payment.paymentType).toBe('UPFRONT');

    // Verify order status updated
    const paidOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(paidOrder?.paymentStatus).toBe(PaymentStatus.PAID_UPFRONT);

    // Verify payment journal: Dr 1600, Cr 1200
    const paymentJournal = await prisma.journalEntry.findFirst({
      where: { companyId: COMPANY_ID, sourceId: payment.id },
      include: { lines: { include: { account: true } } },
    });
    expect(paymentJournal).toBeDefined();

    const advancesDebit = paymentJournal?.lines.find(
      (l) => l.account.code === '1600' && Number(l.debit) > 0
    );
    expect(Number(advancesDebit?.debit)).toBe(1000000);

    console.log(
      '✓ Step 3: Upfront payment registered (Dr 1600 Cr Bank)'
    );

    // ===========================================
    // STEP 4: Receive Goods (GRN) - SAME AS NORMAL
    // Journal: Dr 1400 (Inventory) Cr 2105 (GRN Clearing)
    // ===========================================
    const grn = await inventoryService.createGRN(COMPANY_ID, {
      purchaseOrderId: order.id,
      notes: 'E2E GRN for canonical upfront flow',
      items: [{ productId, quantity: 10 }],
    });
    expect(grn.status).toBe('DRAFT');

    const postedGrn = await inventoryService.postGRN(
      COMPANY_ID,
      grn.id
    );
    expect(postedGrn.status).toBe('POSTED');

    // Verify stock updated
    const productAfterGRN = await prisma.product.findUnique({
      where: { id: productId },
    });
    expect(productAfterGRN?.stockQty).toBe(10);

    // Verify GRN journal: Dr 1400, Cr 2105 (SAME AS NORMAL!)
    const grnJournals = await prisma.journalEntry.findMany({
      where: {
        companyId: COMPANY_ID,
        reference: { contains: grn.number || '' },
      },
      include: { lines: { include: { account: true } } },
    });
    expect(grnJournals.length).toBeGreaterThan(0);

    const grnJournal = grnJournals[0];
    const inventoryDebit = grnJournal?.lines.find(
      (l) => l.account.code === '1400' && Number(l.debit) > 0
    );
    const grnClearingCredit = grnJournal?.lines.find(
      (l) => l.account.code === '2105' && Number(l.credit) > 0
    );
    expect(Number(inventoryDebit?.debit)).toBe(1000000);
    expect(Number(grnClearingCredit?.credit)).toBe(1000000);

    console.log(
      '✓ Step 4: GRN posted (Dr 1400 Cr 2105) - SAME AS NORMAL'
    );

    // ===========================================
    // STEP 5: Create & Post Bill + AUTO SETTLEMENT
    // Bill Journal: Dr 2105 Cr 2100 (SAME AS NORMAL)
    // Settlement Journal: Dr 2100 Cr 1600 (AUTO!)
    // ===========================================
    const bill = await billService.createFromPurchaseOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        taxRate: 0, // No tax for simplicity
      }
    );

    expect(bill.status).toBe(InvoiceStatus.DRAFT);
    expect(Number(bill.amount)).toBe(1000000);

    // Post the bill - this should AUTO TRIGGER settlement
    await billService.post(bill.id, COMPANY_ID, undefined, ACTOR_ID);

    // Check bill status from DB (auto-settlement updates after initial post)
    const updatedBill = await prisma.invoice.findUnique({
      where: { id: bill.id },
    });

    // Bill should be PAID (auto-settled fully)
    expect(updatedBill?.status).toBe(InvoiceStatus.PAID);
    expect(Number(updatedBill?.balance)).toBe(0);

    console.log('✓ Step 5: Bill posted & AUTO SETTLED');

    // ===========================================
    // STEP 6: Verify Bill Journal (Dr 2105 Cr 2100)
    // ===========================================
    const billJournal = await prisma.journalEntry.findFirst({
      where: {
        companyId: COMPANY_ID,
        sourceId: bill.id,
        sourceType: 'BILL',
      },
      include: { lines: { include: { account: true } } },
    });
    expect(billJournal).toBeDefined();

    const grnClearingDebit = billJournal?.lines.find(
      (l) => l.account.code === '2105' && Number(l.debit) > 0
    );
    const apCredit = billJournal?.lines.find(
      (l) => l.account.code === '2100' && Number(l.credit) > 0
    );
    expect(Number(grnClearingDebit?.debit)).toBe(1000000);
    expect(Number(apCredit?.credit)).toBe(1000000);

    console.log('✓ Step 6: Bill journal verified (Dr 2105 Cr 2100)');

    // ===========================================
    // STEP 7: Verify Settlement Journal (Dr 2100 Cr 1600)
    // ===========================================
    const settlementJournals = await prisma.journalEntry.findMany({
      where: {
        companyId: COMPANY_ID,
        reference: { contains: 'Settle Prepaid' },
      },
      include: { lines: { include: { account: true } } },
    });
    expect(settlementJournals.length).toBe(1);

    const settlementJournal = settlementJournals[0];
    const apDebit = settlementJournal?.lines.find(
      (l) => l.account.code === '2100' && Number(l.debit) > 0
    );
    const advancesCredit = settlementJournal?.lines.find(
      (l) => l.account.code === '1600' && Number(l.credit) > 0
    );
    expect(Number(apDebit?.debit)).toBe(1000000);
    expect(Number(advancesCredit?.credit)).toBe(1000000);

    console.log(
      '✓ Step 7: Settlement journal verified (Dr 2100 Cr 1600)'
    );

    // ===========================================
    // STEP 8: Verify Final Statuses
    // ===========================================
    const finalOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(finalOrder?.paymentStatus).toBe(PaymentStatus.SETTLED);

    const settledPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
    });
    expect(settledPayment?.settledAt).toBeDefined();
    expect(settledPayment?.settlementBillId).toBe(bill.id);

    console.log('✓ Step 8: Final statuses verified (SETTLED)');

    // ===========================================
    // STEP 9: Verify Final Account Balances
    // ===========================================
    const allJournals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID },
      include: { lines: { include: { account: true } } },
    });

    const balances: Record<string, number> = {};
    for (const journal of allJournals) {
      for (const line of journal.lines) {
        const code = line.account.code;
        if (!balances[code]) balances[code] = 0;
        balances[code] += Number(line.debit) - Number(line.credit);
      }
    }

    console.log('Account Balances:', balances);

    // 1200 Bank = -1,000,000 (paid out)
    expect(balances['1200'] || 0).toBe(-1000000);

    // 1400 Inventory = +1,000,000 (goods received)
    expect(balances['1400'] || 0).toBe(1000000);

    // 1600 Advances = 0 (created by payment, cleared by settlement)
    expect(balances['1600'] || 0).toBe(0);

    // 2100 AP = 0 (created by bill, cleared by settlement)
    expect(balances['2100'] || 0).toBe(0);

    // 2105 GRN Clearing = 0 (created by GRN, cleared by bill)
    expect(balances['2105'] || 0).toBe(0);

    console.log('✓ Step 9: All account balances verified');
    console.log('');
    console.log('===========================================');
    console.log('✅ CANONICAL P2P UPFRONT FLOW COMPLETE');
    console.log('');
    console.log('Summary of Journals:');
    console.log('  1. Pay:    Dr 1600 Advances     Cr 1200 Bank');
    console.log(
      '  2. GRN:    Dr 1400 Inventory    Cr 2105 GRN Clearing'
    );
    console.log('  3. Bill:   Dr 2105 GRN Clearing Cr 2100 AP');
    console.log('  4. Settle: Dr 2100 AP           Cr 1600 Advances');
    console.log('');
    console.log(
      'Final Balances: Bank=-1M, Inv=+1M, Adv=0, AP=0, GRNI=0'
    );
    console.log('===========================================');
  });
});
