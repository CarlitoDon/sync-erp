import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  OrderStatus,
  InvoiceStatus,
  PaymentTerms,
} from '@sync-erp/database';
import { BillService } from '@modules/accounting/services/bill.service';
import { PaymentService } from '@modules/accounting/services/payment.service';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';
import { InventoryService } from '@modules/inventory/inventory.service';

/**
 * Comprehensive P2P Edge Case Tests
 *
 * Tests all edge cases and error scenarios for the Procure-to-Pay flow:
 * - Validation errors
 * - Over-receiving prevention
 * - Over-billing prevention
 * - Duplicate bill prevention
 * - Void scenarios
 * - Invalid state transitions
 * - Boundary conditions
 * - DP edge cases
 */

const billService = new BillService();
const paymentService = new PaymentService();
const procurementService = new PurchaseOrderService();
const inventoryService = new InventoryService();

const COMPANY_ID = 'test-p2p-edge-cases-001';
const ACTOR_ID = 'test-user-001';

describe('P2P Edge Cases: Comprehensive Error Handling', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test P2P Edge Cases Company' },
      update: {},
    });

    // Setup Required Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '1500', name: 'VAT Receivable', type: 'ASSET' },
      { code: '1550', name: 'Supplier Prepayment', type: 'ASSET' },
      { code: '1600', name: 'DP Prepayment Asset', type: 'ASSET' },
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

    // Setup Partner (Supplier)
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Edge Case Supplier',
        type: 'SUPPLIER',
        email: `edge-supplier-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `EDGE-PROD-${Date.now()}`,
        name: 'Edge Case Product',
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

  // =========================================
  // 1. PO Validation Edge Cases
  // =========================================
  describe('1. PO Validation Edge Cases', () => {
    it('should reject PO with zero quantity', async () => {
      await expect(
        procurementService.create(COMPANY_ID, {
          partnerId,
          type: 'PURCHASE',
          paymentTerms: PaymentTerms.NET30,
          items: [{ productId, quantity: 0, price: 100000 }],
        })
      ).rejects.toThrow();
    });

    it('should reject PO with negative price', async () => {
      await expect(
        procurementService.create(COMPANY_ID, {
          partnerId,
          type: 'PURCHASE',
          paymentTerms: PaymentTerms.NET30,
          items: [{ productId, quantity: 10, price: -100 }],
        })
      ).rejects.toThrow();
    });

    it('should reject PO with empty items', async () => {
      await expect(
        procurementService.create(COMPANY_ID, {
          partnerId,
          type: 'PURCHASE',
          paymentTerms: PaymentTerms.NET30,
          items: [],
        })
      ).rejects.toThrow();
    });

    it('should reject confirming DRAFT PO twice', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });

      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      // Second confirm should fail
      await expect(
        procurementService.confirm(order.id, COMPANY_ID, ACTOR_ID)
      ).rejects.toThrow();
    });
  });

  // =========================================
  // 2. GRN / Receiving Edge Cases
  // =========================================
  describe('2. GRN / Receiving Edge Cases', () => {
    it('should prevent receiving against DRAFT PO', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 10, price: 100000 }],
      });

      // Try to receive without confirming
      await expect(
        inventoryService.createGRN(COMPANY_ID, {
          purchaseOrderId: order.id,
          items: [{ productId, quantity: 10 }],
        })
      ).rejects.toThrow(/confirmed|status/i);
    });

    it('should prevent over-receiving (qty > PO qty)', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      // Try to receive MORE than ordered
      await expect(
        inventoryService.createGRN(COMPANY_ID, {
          purchaseOrderId: order.id,
          items: [{ productId, quantity: 10 }], // 10 > 5 ordered
        })
      ).rejects.toThrow(/exceed|remaining/i);
    });

    it('should prevent cumulative over-receiving', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      // First GRN: 6 units
      const grn1 = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 6 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn1.id,
        undefined,
        ACTOR_ID
      );

      // Second GRN: try 6 more (only 4 remaining)
      await expect(
        inventoryService.createGRN(COMPANY_ID, {
          purchaseOrderId: order.id,
          items: [{ productId, quantity: 6 }],
        })
      ).rejects.toThrow(/exceed|remaining/i);
    });

    it('should allow exact remaining quantity', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      // First GRN: 7 units
      const grn1 = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 7 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn1.id,
        undefined,
        ACTOR_ID
      );

      // Second GRN: exactly 3 remaining - should succeed
      const grn2 = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 3 }],
      });
      expect(grn2).toBeDefined();
    });

    it('should prevent posting GRN twice', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      // Try to post again
      await expect(
        inventoryService.postGRN(
          COMPANY_ID,
          grn.id,
          undefined,
          ACTOR_ID
        )
      ).rejects.toThrow();
    });
  });

  // =========================================
  // 3. Bill Edge Cases
  // =========================================
  describe('3. Bill Edge Cases', () => {
    it('should prevent creating Bill without GRN', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      // No GRN yet
      await expect(
        billService.createFromPurchaseOrder(COMPANY_ID, {
          orderId: order.id,
        })
      ).rejects.toThrow(/goods.*received/i);
    });

    it('should prevent posting Bill twice', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId: order.id,
        }
      );
      await billService.post(
        bill.id,
        COMPANY_ID,
        undefined,
        ACTOR_ID
      );

      // Try to post again
      await expect(
        billService.post(bill.id, COMPANY_ID, undefined, ACTOR_ID)
      ).rejects.toThrow();
    });

    it('should prevent duplicate Bill for same GRN', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      // First Bill
      await billService.createFromPurchaseOrder(COMPANY_ID, {
        orderId: order.id,
        fulfillmentId: grn.id,
      });

      // Second Bill for same GRN should fail
      await expect(
        billService.createFromPurchaseOrder(COMPANY_ID, {
          orderId: order.id,
          fulfillmentId: grn.id,
        })
      ).rejects.toThrow(/already.*bill|bill.*linked/i);
    });
  });

  // =========================================
  // 4. Payment Edge Cases
  // =========================================
  describe('4. Payment Edge Cases', () => {
    it('should prevent payment on DRAFT Bill', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId: order.id,
        }
      );
      // Bill is still DRAFT

      await expect(
        paymentService.create(COMPANY_ID, {
          invoiceId: bill.id,
          amount: 500000,
          method: 'CASH',
        })
      ).rejects.toThrow(/DRAFT|must be POSTED/i);
    });

    it('should prevent overpayment (amount > balance)', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId: order.id,
        }
      );
      await billService.post(
        bill.id,
        COMPANY_ID,
        undefined,
        ACTOR_ID
      );

      // Bill amount is 500,000. Try to pay 1,000,000
      await expect(
        paymentService.create(COMPANY_ID, {
          invoiceId: bill.id,
          amount: 1000000,
          method: 'CASH',
        })
      ).rejects.toThrow(/exceed/i);
    });

    it('should prevent zero amount payment', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId: order.id,
        }
      );
      await billService.post(
        bill.id,
        COMPANY_ID,
        undefined,
        ACTOR_ID
      );

      await expect(
        paymentService.create(COMPANY_ID, {
          invoiceId: bill.id,
          amount: 0,
          method: 'CASH',
        })
      ).rejects.toThrow();
    });

    it('should prevent negative payment', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId: order.id,
        }
      );
      await billService.post(
        bill.id,
        COMPANY_ID,
        undefined,
        ACTOR_ID
      );

      await expect(
        paymentService.create(COMPANY_ID, {
          invoiceId: bill.id,
          amount: -10000,
          method: 'CASH',
        })
      ).rejects.toThrow();
    });
  });

  // =========================================
  // 5. DP (Down Payment) Edge Cases
  // =========================================
  describe('5. DP (Down Payment) Edge Cases', () => {
    it('should block GRN for UPFRONT PO without paid DP', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.UPFRONT,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      // DP Bill exists but not paid
      await expect(
        inventoryService.createGRN(COMPANY_ID, {
          purchaseOrderId: order.id,
          items: [{ productId, quantity: 5 }],
        })
      ).rejects.toThrow(/DP Bill|upfront|confirm/i);
    });

    it('should prevent DP Bill on NET30 PO without dpAmount', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        dpPercent: 0, // No DP
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      // Should not be able to create DP Bill if no DP required
      await expect(
        billService.createDownPaymentBill(COMPANY_ID, order.id)
      ).rejects.toThrow(/UPFRONT|dpAmount/i);
    });

    it('should ensure DP Bill amount equals DP percent of total', async () => {
      const dpPercent = 25;
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        dpPercent,
        items: [{ productId, quantity: 10, price: 100000 }], // Total: 1,000,000
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const dpBill = await billService.createDownPaymentBill(
        COMPANY_ID,
        order.id
      );

      // DP should be 25% of 1,000,000 = 250,000
      expect(Number(dpBill.amount)).toBe(250000);
    });
  });

  // =========================================
  // 6. Void Edge Cases
  // =========================================
  describe('6. Void Edge Cases', () => {
    it('should prevent voiding DRAFT Bill', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId: order.id,
        }
      );
      // Bill is still DRAFT

      await expect(
        billService.void(bill.id, COMPANY_ID, ACTOR_ID, 'Test void')
      ).rejects.toThrow(); // Will throw (permission or status)
    });

    it('should prevent voiding GRN with linked Bill', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      // Create and post Bill linked to this GRN
      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId: order.id,
          fulfillmentId: grn.id,
        }
      );
      await billService.post(
        bill.id,
        COMPANY_ID,
        undefined,
        ACTOR_ID
      );

      // Try to void GRN - should fail because Bill is linked or permission required
      await expect(
        inventoryService.voidGRN(
          COMPANY_ID,
          grn.id,
          'Test void',
          undefined,
          ACTOR_ID
        )
      ).rejects.toThrow(); // Will throw (permission or linked bill)
    });
  });

  // =========================================
  // 7. Tax Edge Cases
  // =========================================
  describe('7. Tax Edge Cases', () => {
    it('should correctly calculate tax on Bill', async () => {
      const taxRate = 11;
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        taxRate,
        items: [{ productId, quantity: 10, price: 100000 }], // Subtotal: 1,000,000
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 10 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId: order.id,
          taxRate,
        }
      );

      // Subtotal: 1,000,000
      // Tax (11%): 110,000
      // Total: 1,110,000
      expect(Number(bill.subtotal)).toBe(1000000);
      expect(Number(bill.taxAmount)).toBe(110000);
      expect(Number(bill.amount)).toBe(1110000);
    });

    it('should handle zero tax rate', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        taxRate: 0,
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 10 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId: order.id,
        }
      );

      expect(Number(bill.subtotal)).toBe(1000000);
      expect(Number(bill.taxAmount)).toBe(0);
      expect(Number(bill.amount)).toBe(1000000);
    });
  });

  // =========================================
  // 8. Status Transition Edge Cases
  // =========================================
  describe('8. Status Transition Edge Cases', () => {
    it('should update Bill to PARTIALLY_PAID on partial payment', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 10 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId: order.id,
        }
      );
      await billService.post(
        bill.id,
        COMPANY_ID,
        undefined,
        ACTOR_ID
      );

      // Partial payment
      await paymentService.create(COMPANY_ID, {
        invoiceId: bill.id,
        amount: 100000, // Bill is 1,000,000
        method: 'CASH',
      });

      const updated = await billService.getById(bill.id, COMPANY_ID);
      expect(updated?.status).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect(Number(updated?.balance)).toBe(900000);
    });

    it('should update Bill to PAID when fully paid', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 5, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      const bill = await billService.createFromPurchaseOrder(
        COMPANY_ID,
        {
          orderId: order.id,
        }
      );
      await billService.post(
        bill.id,
        COMPANY_ID,
        undefined,
        ACTOR_ID
      );

      // Full payment
      await paymentService.create(COMPANY_ID, {
        invoiceId: bill.id,
        amount: 500000,
        method: 'CASH',
      });

      const updated = await billService.getById(bill.id, COMPANY_ID);
      expect(updated?.status).toBe(InvoiceStatus.PAID);
      expect(Number(updated?.balance)).toBe(0);
    });

    it('should update PO to PARTIALLY_RECEIVED after partial GRN', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 5 }], // 50%
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      const updated = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(updated?.status).toBe(OrderStatus.PARTIALLY_RECEIVED);
    });

    it('should update PO to RECEIVED after full GRN', async () => {
      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 10, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 10 }], // 100%
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      const updated = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(updated?.status).toBe(OrderStatus.RECEIVED);
    });
  });

  // =========================================
  // 9. Inventory Edge Cases
  // =========================================
  describe('9. Inventory Edge Cases', () => {
    it('should correctly update stock on GRN post', async () => {
      const initialStock = await prisma.product.findUnique({
        where: { id: productId },
      });
      const startStock = initialStock?.stockQty || 0;

      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [{ productId, quantity: 7, price: 100000 }],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId, quantity: 7 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      const afterStock = await prisma.product.findUnique({
        where: { id: productId },
      });
      expect(afterStock?.stockQty).toBe(startStock + 7);
    });

    it('should correctly calculate average cost', async () => {
      // Create fresh product for this test
      const testProduct = await prisma.product.create({
        data: {
          companyId: COMPANY_ID,
          sku: `AVG-COST-${Date.now()}`,
          name: 'Average Cost Test Product',
          price: 100000,
          averageCost: 0,
          stockQty: 0,
        },
      });

      const order = await procurementService.create(COMPANY_ID, {
        partnerId,
        type: 'PURCHASE',
        paymentTerms: PaymentTerms.NET30,
        items: [
          { productId: testProduct.id, quantity: 10, price: 50000 },
        ],
      });
      await procurementService.confirm(
        order.id,
        COMPANY_ID,
        ACTOR_ID
      );

      const grn = await inventoryService.createGRN(COMPANY_ID, {
        purchaseOrderId: order.id,
        items: [{ productId: testProduct.id, quantity: 10 }],
      });
      await inventoryService.postGRN(
        COMPANY_ID,
        grn.id,
        undefined,
        ACTOR_ID
      );

      const updated = await prisma.product.findUnique({
        where: { id: testProduct.id },
      });
      expect(Number(updated?.averageCost)).toBe(50000);
    });
  });
});
