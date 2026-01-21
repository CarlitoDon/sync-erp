import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma, InvoiceStatus } from '@sync-erp/database';
import { BillService } from '@modules/accounting/services/bill.service';
import { PaymentService } from '@modules/accounting/services/payment.service';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';
import { InventoryService } from '@modules/inventory/inventory.service';

const billService = new BillService();
const paymentService = new PaymentService();
const procurementService = new PurchaseOrderService();
const inventoryService = new InventoryService();

const COMPANY_ID = 'test-3way-tax-001';
const ACTOR_ID = 'test-user-001';

/**
 * Test Suite: 3-Way Matching with Tax and DP
 *
 * This test exposes a bug where 3-way matching validation fails due to
 * inconsistent DP deduction formulas between Bill creation and validation.
 *
 * Bill creation uses: subtotal - dpDeducted / (1 + taxMultiplier)
 * 3-way matching uses: orderSubtotal - dpPaid (raw, no tax adjustment)
 *
 * Expected behavior after fix: Bill with tax+DP should post successfully.
 */
describe('3-Way Matching with Tax and DP', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test 3-Way Tax Company' },
      update: {},
    });

    // Setup Required Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '1500', name: 'VAT Receivable', type: 'ASSET' },
      { code: '1600', name: 'Advances to Supplier', type: 'ASSET' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
      { code: '2105', name: 'GRNI Accrued', type: 'LIABILITY' },
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

    // Setup Partner (Supplier)
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Supplier 3-Way',
        type: 'SUPPLIER',
        email: `supplier-3way-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `3WAY-SKU-${Date.now()}`,
        name: 'Test 3-Way Product',
        price: 1000000, // 1M IDR per unit
        averageCost: 0,
        stockQty: 0,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup in proper order
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

  describe('BUG: Tax-adjusted DP deduction mismatch', () => {
    it('should post Bill with 5% tax without 3-way mismatch', async () => {
      // Create PO: 10 units @ 1M each = 10M subtotal
      // Tax rate: 5%
      // NO DP - to isolate the subtotal comparison bug
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: 'NET30',
        taxRate: 5, // 5%
        items: [{ productId, quantity: 10, price: 1000000 }],
      });
      expect(order.id).toBeDefined();

      // Verify order values
      console.log('Order created:', {
        totalAmount: Number(order.totalAmount),
        taxRate: Number(order.taxRate),
      });

      // Confirm PO
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      // Receive goods (full qty)
      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 10 }],
      });
      await inventoryService.postGRN(COMPANY_ID, grn.id);

      // Create Bill from PO (should auto-calculate subtotal with tax)
      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId: order.id,
          taxRate: 5, // 5%
        }
      );
      expect(bill.status).toBe(InvoiceStatus.DRAFT);

      // Log values for debugging
      console.log('Bill created:', {
        subtotal: Number(bill.subtotal),
        taxAmount: Number(bill.taxAmount),
        amount: Number(bill.amount),
      });

      // Expected:
      // subtotal = 10 * 1M = 10M
      // taxAmount = 10M * 5% = 500K
      // amount = 10.5M
      expect(Number(bill.subtotal)).toBe(10000000);
      expect(Number(bill.taxAmount)).toBe(500000);
      expect(Number(bill.amount)).toBe(10500000);

      // Post Bill - This should work (no 3-way bug for NET30 without DP)
      const postedBill = await billService.post(
        bill.id,
        COMPANY_ID,
        undefined,
        ACTOR_ID
      );
      expect(postedBill.status).toBe(InvoiceStatus.POSTED);
    });
  });

  describe('BUG: DP deduction with Tax mismatch', () => {
    it('should post Bill with 5% tax AND DP without 3-way mismatch', async () => {
      // This test exposes a bug where:
      // - Bill creation calculates: subtotal - dpDeducted / (1 + taxMultiplier)
      // - 3-way matching calculates: orderSubtotal - dpPaid (raw, no tax adjustment)

      // Create PO: 10 units @ 1M each = 10M subtotal
      // Tax rate: 5% -> totalAmount = 10.5M
      // DP: 20% of totalAmount = 2.1M
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: 'NET30',
        taxRate: 5, // 5%
        dpPercent: 20, // 20% DP
        items: [{ productId, quantity: 10, price: 1000000 }],
      });

      console.log('Order with DP+Tax:', {
        totalAmount: Number(order.totalAmount),
        taxRate: Number(order.taxRate),
        dpPercent: Number(order.dpPercent),
        dpAmount: Number(order.dpAmount),
      });

      // Confirm PO
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      // Create DP Bill manually (Feature 041: manual DP Bill creation)
      const dpBill = await billService.createDownPaymentBill(
        COMPANY_ID,
        order.id
      );
      expect(dpBill).toBeDefined();
      console.log('DP Bill:', {
        id: dpBill?.id,
        amount: Number(dpBill?.amount),
        status: dpBill?.status,
      });

      // Post DP Bill first
      const postedDpBill = await billService.post(
        dpBill!.id,
        COMPANY_ID,
        undefined,
        ACTOR_ID
      );

      // Pay DP Bill
      await paymentService.create(COMPANY_ID, {
        invoiceId: dpBill!.id,
        amount: Number(postedDpBill.amount),
        method: 'BANK_TRANSFER',
      });

      // Receive goods (full qty)
      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 10 }],
      });
      await inventoryService.postGRN(COMPANY_ID, grn.id);

      // Create final Bill from PO (should deduct DP with tax adjustment)
      const finalBill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId: order.id,
          taxRate: 5, // 5%
        }
      );

      console.log('Final Bill (after DP deduction):', {
        subtotal: Number(finalBill.subtotal),
        taxAmount: Number(finalBill.taxAmount),
        amount: Number(finalBill.amount),
      });

      // Post final Bill - THIS IS WHERE THE BUG MAY OCCUR
      // If 3-way matching uses different DP deduction formula, it will fail
      const postedFinal = await billService.post(
        finalBill.id,
        COMPANY_ID,
        undefined,
        ACTOR_ID
      );
      expect(postedFinal.status).toBe(InvoiceStatus.POSTED);
    });
  });
});
