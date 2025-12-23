import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  OrderStatus,
  InvoiceStatus,
} from '@sync-erp/database';
import { BillService } from '@modules/accounting/services/bill.service';
import { JournalService } from '@modules/accounting/services/journal.service';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';
import { InventoryService } from '@modules/inventory/inventory.service';

const billService = new BillService();
const journalService = new JournalService();
const procurementService = new PurchaseOrderService();
const inventoryService = new InventoryService();

const COMPANY_ID = 'test-p2p-integration-001';
const ACTOR_ID = 'test-user-001';

describe('Standard P2P Flow (Procure-to-Pay)', () => {
  let productId: string;
  let partnerId: string;
  let orderId: string;
  let billId: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test P2P Company' },
      update: {},
    });

    // 2. Setup Required Accounts (must match JournalService account codes)
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '1500', name: 'VAT Receivable', type: 'ASSET' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
      { code: '2105', name: 'GRNI Accrued', type: 'LIABILITY' },
      { code: '2300', name: 'VAT Payable', type: 'LIABILITY' },
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
          type: acc.type as any,
          isActive: true,
        },
      });
    }

    // 3. Setup Partner (Supplier)
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Supplier P2P',
        type: 'SUPPLIER',
        email: `supplier-p2p-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // 4. Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `P2P-SKU-${Date.now()}`,
        name: 'Test P2P Product',
        price: 80000,
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
      // Delete GRN/Shipments first
      prisma.goodsReceiptItem.deleteMany({
        where: { goodsReceipt: { companyId: COMPANY_ID } },
      }),
      prisma.goodsReceipt.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.shipmentItem.deleteMany({
        where: { shipment: { companyId: COMPANY_ID } },
      }),
      prisma.shipment.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      // Then OrderItems
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

  describe('US2: Complete Procure-to-Pay Cycle', () => {
    it('Full P2P Flow: PO -> GRN -> Bill -> Post -> Journal', async () => {
      // Step 1: Create and confirm Purchase Order
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: 'NET30',
        items: [{ productId, quantity: 10, price: 80000 }],
      });
      orderId = order.id;
      expect(order.status).toBe(OrderStatus.DRAFT);

      const confirmedOrder = await procurementService.confirm(
        orderId,
        COMPANY_ID,
        ACTOR_ID
      );
      expect(confirmedOrder.status).toBe(OrderStatus.CONFIRMED);

      // Step 2: Create and Post GRN
      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: orderId,
        notes: `GRN for PO ${orderId}`,
        items: [{ productId, quantity: 10 }],
      });
      expect(grn.status).toBe('DRAFT');

      const postedGrn = await inventoryService.postGRN(
        COMPANY_ID,
        grn.id
      );
      expect(postedGrn.status).toBe('POSTED');

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      expect(product?.stockQty).toBe(10);

      // Step 3: Create Bill from confirmed PO (after GRN)
      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId,
          taxRate: 0.11,
        }
      );
      billId = bill.id;
      expect(bill.status).toBe(InvoiceStatus.DRAFT);
      expect(bill.orderId).toBe(orderId);
      expect(Number(bill.subtotal)).toBe(800000);
      expect(Number(bill.taxAmount)).toBe(88000);
      expect(Number(bill.amount)).toBe(888000);

      // Step 4: Post Bill with AuditLog and correlationId
      const correlationId = `corr-p2p-${Date.now()}`;
      const postedBill = await billService.post(
        billId,
        COMPANY_ID,
        undefined,
        ACTOR_ID,
        correlationId
      );
      expect(postedBill.status).toBe(InvoiceStatus.POSTED);

      // Verify AuditLog
      const auditLogs = await prisma.auditLog.findMany({
        where: { companyId: COMPANY_ID, entityId: billId },
      });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].action).toBe('BILL_POSTED');
      expect(auditLogs[0].correlationId).toBe(correlationId);

      // Step 5: Verify Journal entries (FR-011)
      const journals = await journalService.list(COMPANY_ID);
      const billJournal = journals.find(
        (j: any) => j.sourceType === 'BILL' && j.sourceId === billId
      ) as any;
      expect(billJournal).toBeDefined();

      const totalDebit = billJournal.lines.reduce(
        (sum: number, l: any) => sum + Number(l.debit),
        0
      );
      const totalCredit = billJournal.lines.reduce(
        (sum: number, l: any) => sum + Number(l.credit),
        0
      );
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
    });
  });

  describe('FR-001: Bill Creation Prerequisites', () => {
    it('Should fail to create Bill without GRN', async () => {
      // Create another PO without receiving goods
      const order2 = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        items: [{ productId, quantity: 5, price: 80000 }],
        paymentTerms: 'NET30',
      });
      await procurementService.confirm(
        order2.id,
        COMPANY_ID,
        'test-user-id'
      );

      // Try to create bill without GRN - should fail
      await expect(
        billService.createFromPurchaseOrder(COMPANY_ID, {
          orderId: order2.id,
        })
      ).rejects.toThrow(/goods.*received/i);
    });
  });
});
