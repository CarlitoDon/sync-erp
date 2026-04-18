import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  OrderStatus,
  PaymentTerms,
  PaymentStatus,
} from '@sync-erp/database';
import { SalesOrderService } from '../../src/modules/sales/sales-order.service';
import { CustomerDepositService } from '../../src/modules/sales/customer-deposit.service';

const salesOrderService = new SalesOrderService();
const customerDepositService = new CustomerDepositService();

const COMPANY_ID = 'test-customer-deposit-001';
const ACTOR_ID = 'test-user-001';

describe('Cash Upfront Sales: Customer Deposits', () => {
  let productId: string;
  let partnerId: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Test Customer Deposit Company',
      },
      update: {},
    });

    // 2. Setup Required Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
      { code: '2200', name: 'Customer Deposits', type: 'LIABILITY' },
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

    // 3. Setup Partner (Customer)
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Upfront Customer',
        type: 'CUSTOMER',
        email: `upfront-customer-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    // 4. Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `CUST-DEP-SKU-${Date.now()}`,
        name: 'Test Customer Deposit Product',
        price: 100000,
        averageCost: 80000,
        stockQty: 100,
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

  describe('US1: Create SO with Upfront Terms', () => {
    it('Should create SO with UPFRONT payment terms', async () => {
      const order = await salesOrderService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 10, price: 100000 }],
        type: 'SALES',
        paymentTerms: 'UPFRONT',
      });

      expect(order.status).toBe(OrderStatus.DRAFT);
      expect(order.paymentTerms).toBe(PaymentTerms.UPFRONT);
      expect(order.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(Number(order.paidAmount)).toBe(0);
      expect(Number(order.totalAmount)).toBe(1000000); // 10 * 100000
    });
  });

  describe('US2: Register Customer Deposit', () => {
    it('Should register customer deposit and create journal (Dr Bank Cr 2200)', async () => {
      // Create and confirm an UPFRONT SO
      const order = await salesOrderService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 5, price: 100000 }],
        type: 'SALES',
        paymentTerms: 'UPFRONT',
      });
      await salesOrderService.confirm(order.id, COMPANY_ID, ACTOR_ID);

      // Register customer deposit
      const deposit = await customerDepositService.registerDeposit(
        COMPANY_ID,
        {
          orderId: order.id,
          amount: 500000, // Full amount
          method: 'BANK',
          reference: 'TRF-CUST-001',
        },
        ACTOR_ID
      );

      expect(deposit.orderId).toBe(order.id);
      expect(Number(deposit.amount)).toBe(500000);
      expect(deposit.paymentType).toBe('UPFRONT');

      // Verify journal was created
      const journals = await prisma.journalEntry.findMany({
        where: {
          companyId: COMPANY_ID,
          sourceId: deposit.id,
        },
        include: { lines: true },
      });

      expect(journals).toHaveLength(1);
      expect(journals[0].reference).toContain('Customer Deposit');

      // Verify journal lines: Dr 1200 (Bank), Cr 2200 (Customer Deposits)
      const lines = journals[0].lines;
      expect(lines).toHaveLength(2);

      const debitLine = lines.find((l) => Number(l.debit) > 0);
      const creditLine = lines.find((l) => Number(l.credit) > 0);

      expect(Number(debitLine?.debit)).toBe(500000);
      expect(Number(creditLine?.credit)).toBe(500000);
    });

    it('Should update SO paymentStatus to PAID_UPFRONT when fully paid', async () => {
      const order = await salesOrderService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 2, price: 50000 }],
        type: 'SALES',
        paymentTerms: 'UPFRONT',
      });
      await salesOrderService.confirm(order.id, COMPANY_ID, ACTOR_ID);

      await customerDepositService.registerDeposit(
        COMPANY_ID,
        {
          orderId: order.id,
          amount: 100000, // Full amount
          method: 'CASH',
        },
        ACTOR_ID
      );

      // Verify order status updated
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });

      expect(updatedOrder?.paymentStatus).toBe(
        PaymentStatus.PAID_UPFRONT
      );
      expect(Number(updatedOrder?.paidAmount)).toBe(100000);
    });

    it('Should prevent deposit exceeding SO amount', async () => {
      const order = await salesOrderService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 1, price: 100000 }],
        type: 'SALES',
        paymentTerms: 'UPFRONT',
      });
      await salesOrderService.confirm(order.id, COMPANY_ID, ACTOR_ID);

      await expect(
        customerDepositService.registerDeposit(
          COMPANY_ID,
          {
            orderId: order.id,
            amount: 200000, // Exceeds SO amount
            method: 'CASH',
          },
          ACTOR_ID
        )
      ).rejects.toThrow(/exceeds/i);
    });
  });

  describe('US3: Get Deposit Summary', () => {
    it('Should return deposit summary for SO', async () => {
      const order = await salesOrderService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 5, price: 100000 }],
        type: 'SALES',
        paymentTerms: 'UPFRONT',
      });
      await salesOrderService.confirm(order.id, COMPANY_ID, ACTOR_ID);

      await customerDepositService.registerDeposit(
        COMPANY_ID,
        { orderId: order.id, amount: 250000, method: 'CASH' },
        ACTOR_ID
      );

      const summary = await customerDepositService.getDepositSummary(
        COMPANY_ID,
        order.id
      );

      expect(summary.totalAmount).toBe(500000);
      expect(summary.paidAmount).toBe(250000);
      expect(summary.remainingAmount).toBe(250000);
      expect(summary.paymentStatus).toBe(PaymentStatus.PARTIAL);
      expect(summary.payments).toHaveLength(1);
    });
  });
  describe('Edge Cases', () => {
    it('Should allow register deposit for non-UPFRONT order (Tempo+DP)', async () => {
      const order = await salesOrderService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 1, price: 100 }],
        type: 'SALES',
        paymentTerms: 'NET30', // Not UPFRONT
      });
      await salesOrderService.confirm(order.id, COMPANY_ID, ACTOR_ID);

      const deposit = await customerDepositService.registerDeposit(
        COMPANY_ID,
        { orderId: order.id, amount: 50, method: 'CASH' },
        ACTOR_ID
      );

      expect(Number(deposit.amount)).toBe(50);
      expect(deposit.orderId).toBe(order.id);
    });

    it('Should fail to register deposit for unconfirmed order', async () => {
      const order = await salesOrderService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 1, price: 100 }],
        type: 'SALES',
        paymentTerms: 'UPFRONT',
      });
      // Not confirmed

      await expect(
        customerDepositService.registerDeposit(
          COMPANY_ID,
          { orderId: order.id, amount: 100, method: 'CASH' },
          ACTOR_ID
        )
      ).rejects.toThrow();
    });

    it('Should fail to register negative deposit', async () => {
      const order = await salesOrderService.create(COMPANY_ID, {
        partnerId,
        items: [{ productId, quantity: 1, price: 100 }],
        type: 'SALES',
        paymentTerms: 'UPFRONT',
      });
      await salesOrderService.confirm(order.id, COMPANY_ID, ACTOR_ID);

      await expect(
        customerDepositService.registerDeposit(
          COMPANY_ID,
          { orderId: order.id, amount: -100, method: 'CASH' },
          ACTOR_ID
        )
      ).rejects.toThrow();
    });
  });
});
