import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma, PaymentMethodType } from '@sync-erp/database';
import { BillService } from '../../src/modules/accounting/services/bill.service';
import { PurchaseOrderService } from '../../src/modules/procurement/purchase-order.service';
import { PaymentService } from '../../src/modules/accounting/services/payment.service';
import { InventoryService } from '../../src/modules/inventory/inventory.service';

const billService = new BillService();
const procurementService = new PurchaseOrderService();
const paymentService = new PaymentService();
const inventoryService = new InventoryService();

const COMPANY_ID = 'test-overbilling-bug-001';
const ACTOR_ID = 'test-user-001';

describe('PO Over-billing Bug Reproduction', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test Overbilling Bug' },
      update: {},
    });

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

    // Setup Partner
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Correct Supplier',
        type: 'SUPPLIER',
        email: `correct-supplier-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `CORRECT-PROD-${Date.now()}`,
        name: 'Correct Product',
        price: 10000,
        stockQty: 0,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma
      .$transaction([
        prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN (SELECT id FROM "JournalEntry" WHERE "companyId" = ${COMPANY_ID})`,
        prisma.journalEntry.deleteMany({
          where: { companyId: COMPANY_ID },
        }),
        prisma.payment.deleteMany({
          where: { companyId: COMPANY_ID },
        }),
        prisma.invoice.deleteMany({
          where: { companyId: COMPANY_ID },
        }),
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
        prisma.product.deleteMany({
          where: { companyId: COMPANY_ID },
        }),
        prisma.account.deleteMany({
          where: { companyId: COMPANY_ID },
        }),
        prisma.partner.deleteMany({
          where: { companyId: COMPANY_ID },
        }),
        prisma.company.delete({ where: { id: COMPANY_ID } }),
      ])
      .catch(() => {});
  });

  it('should correctly bill partial GRNs with DP without over-billing', async () => {
    // 1. Create PO with 50% DP and 10% Tax
    // Total Items: 10 * 10,000 = 100,000
    // Tax: 10% = 10,000
    // Grand Total: 110,000
    // DP: 50% = 55,000
    const order = await procurementService.create(COMPANY_ID, {
      partnerId,
      type: 'PURCHASE',
      paymentTerms: 'NET30',
      dpPercent: 50,
      taxRate: 10,
      items: [{ productId, quantity: 10, price: 10000 }],
    });

    await procurementService.confirm(order.id, COMPANY_ID, ACTOR_ID);

    // Feature 041: Manually create DP Bill
    await billService.createDownPaymentBill(COMPANY_ID, order.id);

    // 2. Pay DP Bill
    const dpBill = await prisma.invoice.findFirst({
      where: { orderId: order.id, isDownPayment: true },
    });
    expect(dpBill).not.toBeNull();
    expect(Number(dpBill!.amount.toString())).toBe(55000);

    await billService.post(
      dpBill!.id,
      COMPANY_ID,
      undefined,
      ACTOR_ID
    );
    await paymentService.create(COMPANY_ID, {
      invoiceId: dpBill!.id,
      amount: 55000,
      method: PaymentMethodType.CASH,
    });

    // 3. Create GRN 1: Half quantities (5 units)
    const grn1 = await inventoryService.createGRN(COMPANY_ID, {
      purchaseOrderId: order.id,
      items: [{ productId, quantity: 5 }],
    });
    await inventoryService.postGRN(COMPANY_ID, grn1.id);

    // 4. Create Bill 1 from PO (Should only bill GRN 1 items)
    // GRN 1 Subtotal: 50,000
    // Tax: 5,000
    // Total: 55,000
    // DP Deduction: 55,000
    // Final Bill Amount: 0
    const bill1 = await billService.createFromPurchaseOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        fulfillmentId: grn1.id, // Feature 041: Changed from grnId
      }
    );

    expect(Number(bill1.amount.toString())).toBe(27500);

    // 5. Create GRN 2: Remaining half (5 units)
    const grn2 = await inventoryService.createGRN(COMPANY_ID, {
      purchaseOrderId: order.id,
      items: [{ productId, quantity: 5 }],
    });
    await inventoryService.postGRN(COMPANY_ID, grn2.id);

    // 6. Create Bill 2 from PO (Should bill remaining items from GRN 2)
    // GRN 2 Subtotal: 50,000
    // Tax: 5,000
    // Total: 55,000
    // DP Deduction: 27,500 (Proportional)
    // Final Bill Amount: 27,500
    const bill2 = await billService.createFromPurchaseOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        fulfillmentId: grn2.id, // Feature 041: Changed from grnId
      }
    );

    expect(Number(bill2.amount.toString())).toBe(27500);

    const totalBilled =
      55000 +
      Number(bill1.amount.toString()) +
      Number(bill2.amount.toString());
    expect(totalBilled).toBe(110000);
  });
});
