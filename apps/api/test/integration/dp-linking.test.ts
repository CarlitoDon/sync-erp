import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma, PaymentMethodType } from '@sync-erp/database';
import { BillService } from '../../src/modules/accounting/services/bill.service';
import { PurchaseOrderService } from '../../src/modules/procurement/purchase-order.service';
import { PaymentService } from '../../src/modules/accounting/services/payment.service';

const billService = new BillService();
const procurementService = new PurchaseOrderService();
const paymentService = new PaymentService();

const COMPANY_ID = 'test-dp-linking-001';
const ACTOR_ID = 'test-user-001';

describe('DP Bill Linking (Feature Implementation)', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test DP Linking Company' },
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
          type: acc.type as import("@sync-erp/database").AccountType,
          isActive: true,
        },
      });
    }

    // Setup Partner
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'DP Linking Supplier',
        type: 'SUPPLIER',
        email: `dp-link-supplier-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `DP-LINK-${Date.now()}`,
        name: 'DP Link Product',
        price: 1000000,
        stockQty: 0,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup with proper FK constraint order
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
      .catch(() => {}); // Low effort cleanup
  });

  it('should explicitly link DP Bill to Final Bill', async () => {
    // 1. Create PO with 50% DP
    const order = await procurementService.create(COMPANY_ID, {
      partnerId,
      type: 'PURCHASE',
      paymentTerms: 'NET30',
      dpPercent: 50,
      items: [{ productId, quantity: 2, price: 1000000 }], // Total 2M
    });

    // 2. Confirm PO
    await procurementService.confirm(order.id, COMPANY_ID, ACTOR_ID);

    // 3. Create DP Bill manually (Feature 041: manual DP Bill creation)
    const dpBill = await billService.createDownPaymentBill(
      COMPANY_ID,
      order.id
    );

    expect(dpBill).toBeDefined();
    expect(dpBill?.isDownPayment).toBe(true);
    expect(Number(dpBill?.amount)).toBe(1000000); // 50% of 2M

    // 4. Pay DP Bill (required to create final bill with deduction)
    await billService.post(
      dpBill!.id,
      COMPANY_ID,
      undefined,
      ACTOR_ID
    );
    await paymentService.create(COMPANY_ID, {
      invoiceId: dpBill!.id,
      amount: 1000000,
      method: PaymentMethodType.CASH,
    });

    // 5. Create Final Bill
    // We assume goods receipt is not strictly enforced for draft creation in logic or blocked
    // Actually createFromPurchaseOrder checks GRN. Let's fake mock GRN count or just enable it.
    // Real logic: BillPolicy.ensureGoodsReceived(grnCount).
    // Let's rely on InventoryService.
    const { InventoryService } =
      await import('../../src/modules/inventory/inventory.service');
    const inventoryService = new InventoryService();
    const grn = await inventoryService.createGRN(COMPANY_ID, {
      purchaseOrderId: order.id,
      items: [{ productId, quantity: 2 }],
    });
    await inventoryService.postGRN(COMPANY_ID, grn.id);

    const finalBill = await billService.createFromPurchaseOrder(
      COMPANY_ID,
      {
        orderId: order.id,
      }
    );

    // 6. Verify Linking
    expect(finalBill.dpBillId).toBe(dpBill!.id);
    // Note: subtotal stays at original order value (2M), only amount is reduced by DP
    expect(Number(finalBill.subtotal)).toBe(2000000); // Original order subtotal
    expect(Number(finalBill.amount)).toBe(1000000); // 2M (no tax) - 1M DP = 1M

    // 7. Verify Repository Inclusion
    const fetchedBill = await billService.getById(
      finalBill.id,
      COMPANY_ID
    );
    expect(fetchedBill).toBeDefined();
    // Use 'as any' if types aren't fully updated in test context yet, but should be generated
    // prisma clients return types include relations if included in query
    expect((fetchedBill as unknown as { dpBill: { id: string } }).dpBill).toBeDefined();
    expect((fetchedBill as unknown as { dpBill: { id: string } }).dpBill.id).toBe(dpBill!.id);
  });
});
