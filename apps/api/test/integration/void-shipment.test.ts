import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma, OrderStatus } from '@sync-erp/database';
import { InventoryService } from '@modules/inventory/inventory.service';
import { SalesOrderService } from '@modules/sales/sales-order.service';
import { ProductService } from '@modules/product/product.service';

const inventoryService = new InventoryService();
const salesOrderService = new SalesOrderService();
const productService = new ProductService();

const COMPANY_ID = 'test-void-shipment-001';

describe('O2C: Void Shipment & Status Recalculation', () => {
  let productId: string;
  let partnerId: string;
  let orderId: string;
  let shipmentId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test Void Shipment' },
      update: {},
    });

    // Setup Required Accounts
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

    // Setup Partner
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Customer Void',
        type: 'CUSTOMER',
        email: `customer-void-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `VOID-SKU-${Date.now()}`,
        name: 'Void Test Product',
        price: 100000,
        averageCost: 50000,
        stockQty: 100,
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
      // Delete journal lines first (they reference entries and accounts)
      prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN (SELECT id FROM "JournalEntry" WHERE "companyId" = ${COMPANY_ID})`,
      prisma.journalEntry.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.inventoryMovement.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.shipmentItem.deleteMany({
        where: { shipment: { companyId: COMPANY_ID } },
      }),
      prisma.shipment.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.orderItem.deleteMany({
        where: { order: { companyId: COMPANY_ID } },
      }),
      prisma.order.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.product.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.account.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.delete({ where: { id: COMPANY_ID } }),
    ]);
  });

  it('should handle full shipment cycle: Create -> Ship -> Complete -> Void -> Confirmed', async () => {
    // 1. Create SO
    const order = await salesOrderService.create(COMPANY_ID, {
      partnerId,
      type: 'SALES',
      items: [{ productId, quantity: 10, price: 100000 }],
    });
    orderId = order.id;
    await salesOrderService.confirm(orderId, COMPANY_ID);

    // Verify Initial Stock
    let product = await productService.getById(productId, COMPANY_ID);
    expect(product?.stockQty).toBe(100);

    // 2. Ship Full Quantity
    // Note: SalesOrderService.ship calls createShipment AND postShipment atomically
    await salesOrderService.ship(COMPANY_ID, orderId);

    // Check Status -> SHIPPED (fully shipped, not COMPLETED - that's after Invoice)
    const shippedOrder = await salesOrderService.getById(
      orderId,
      COMPANY_ID
    );
    expect(shippedOrder?.status).toBe(OrderStatus.SHIPPED);

    // Check Stock -> 90
    product = await productService.getById(productId, COMPANY_ID);
    expect(product?.stockQty).toBe(90);

    // Get the created shipment
    const shipments =
      await inventoryService.listShipments(COMPANY_ID);
    const shipment = shipments.find(
      (s) => s.salesOrderId === orderId
    );
    expect(shipment).toBeDefined();
    expect(shipment?.status).toBe('POSTED');
    shipmentId = shipment!.id;

    // 3. Void Shipment
    await inventoryService.voidShipment(COMPANY_ID, shipmentId);

    // 4. Verify Rollback

    // Status -> CONFIRMED (since 0 shipped now)
    const revertedOrder = await salesOrderService.getById(
      orderId,
      COMPANY_ID
    );
    expect(revertedOrder?.status).toBe(OrderStatus.CONFIRMED);

    // Stock -> 100 (Restocked)
    product = await productService.getById(productId, COMPANY_ID);
    expect(product?.stockQty).toBe(100);

    // Shipment Status -> VOIDED
    const voidedShipment = await inventoryService.getShipment(
      COMPANY_ID,
      shipmentId
    );
    expect(voidedShipment?.status).toBe('VOIDED');
  });
});
