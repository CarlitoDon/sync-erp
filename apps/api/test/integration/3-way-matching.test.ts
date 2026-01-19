/**
 * FR-011, FR-020: 3-Way Matching Integration Tests
 *
 * Tests the conditional 3-way matching logic:
 * 1. Normal NET30 flow - matching enforced
 * 2. DP Bill - matching skipped
 * 3. UPFRONT Bill - matching skipped
 * 4. Final Bill with qty mismatch - should fail
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma, InvoiceStatus } from '@sync-erp/database';
import { BillService } from '@modules/accounting/services/bill.service';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';
import { InventoryService } from '@modules/inventory/inventory.service';

const billService = new BillService();
const procurementService = new PurchaseOrderService();
const inventoryService = new InventoryService();

const COMPANY_ID = 'test-3way-match-001';
const ACTOR_ID = 'test-user-001';

describe('FR-011, FR-020: 3-Way Matching Validation', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test 3-Way Match Company' },
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

    // Setup Supplier
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
        price: 100000,
        averageCost: 0,
        stockQty: 0,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
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

  describe('Normal NET30 Flow (3-Way Matching Enforced)', () => {
    it('should pass 3-way matching when qty and amount match', async () => {
      // Create and confirm PO
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: 'NET30',
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      // Create and post GRN with matching qty
      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 10 }],
      });
      await inventoryService.postGRN(COMPANY_ID, grn.id);

      // Create Bill
      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId: order.id,
          taxRate: 0,
        }
      );

      // Post Bill - should pass 3-way matching
      const postedBill = await billService.post(
        bill.id,
        COMPANY_ID,
        undefined,
        ACTOR_ID
      );

      expect(postedBill.status).toBe(InvoiceStatus.POSTED);
    });

    it('should fail 3-way matching when qty mismatch', async () => {
      // Create and confirm PO for 20 units
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: 'NET30',
        items: [{ productId, quantity: 20, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      // Create and post GRN with only 15 units (partial)
      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 15 }],
      });
      await inventoryService.postGRN(COMPANY_ID, grn.id);

      // Create Bill (will be for full PO amount)
      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId: order.id,
          taxRate: 0,
        }
      );

      // FORCE OVERBILLING: Update Bill to be for full PO amount (20 units = 2,000,000)
      // because default logic auto-corrects to match GRN (15 units)
      await prisma.invoice.update({
        where: { id: bill.id },
        data: { amount: 2000000, subtotal: 2000000 },
      });

      // Post Bill - should FAIL 3-way matching (ordered 20, received 15)
      await expect(
        billService.post(bill.id, COMPANY_ID, undefined, ACTOR_ID)
      ).rejects.toThrow(/3-way matching failed.*Qty mismatch/i);
    });
  });

  describe('DP Bill (3-Way Matching Skipped)', () => {
    it('should skip 3-way matching for DP Bills', async () => {
      // Create PO with 30% DP
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: 'NET30',
        dpPercent: 30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });

      // Confirm PO - this auto-creates DP Bill
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      // Find the DP Bill
      const dpBill = await prisma.invoice.findFirst({
        where: {
          orderId: order.id,
          companyId: COMPANY_ID,
          isDownPayment: true,
        },
      });

      expect(dpBill).toBeDefined();
      expect(dpBill?.status).toBe(InvoiceStatus.DRAFT);

      // Post DP Bill - should NOT check 3-way matching (no GRN yet!)
      const postedDpBill = await billService.post(
        dpBill!.id,
        COMPANY_ID,
        undefined,
        ACTOR_ID
      );

      expect(postedDpBill.status).toBe(InvoiceStatus.POSTED);
    });
  });
});
