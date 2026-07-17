import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AccountType,
  BillInstallmentStatus,
  BusinessShape,
  DocumentStatus,
  FulfillmentType,
  InvoiceStatus,
  InvoiceType,
  OrderStatus,
  OrderType,
  PaymentMethodType,
  PaymentTerms,
  prisma,
} from '@sync-erp/database';
import { BillInstallmentService } from '@modules/accounting/services/bill-installment.service';
import { BillService } from '@modules/accounting/services/bill.service';
import { PaymentService } from '@modules/accounting/services/payment.service';
import { RentalService } from '@modules/rental/rental.service';

const COMPANY_ID = 'test-rental-business-logic';
const ACTOR_ID = 'test-rental-actor';

describe('Rental business logic support', () => {
  const billInstallmentService = new BillInstallmentService();
  const billService = new BillService();
  const paymentService = new PaymentService();
  const rentalService = new RentalService();

  let supplierId: string;
  let productId: string;
  let rentalItemId: string;

  beforeAll(async () => {
    await cleanup();

    await prisma.company.create({
      data: {
        id: COMPANY_ID,
        name: 'Rental Company Test',
        businessShape: BusinessShape.RENTAL,
      },
    });

    const accounts = [
      { code: '1100', name: 'Cash', type: AccountType.ASSET },
      { code: '1200', name: 'Bank', type: AccountType.ASSET },
      { code: '1400', name: 'Inventory', type: AccountType.ASSET },
      {
        code: '2100',
        name: 'Accounts Payable',
        type: AccountType.LIABILITY,
      },
      {
        code: '5200',
        name: 'Inventory Adjustment',
        type: AccountType.EXPENSE,
      },
    ];

    await prisma.account.createMany({
      data: accounts.map((account) => ({
        companyId: COMPANY_ID,
        ...account,
      })),
    });

    const supplier = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Rental Supplier Test',
        type: 'SUPPLIER',
      },
    });
    supplierId = supplier.id;

    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: 'KSR-RGE-100-BIRU-TEST',
        name: 'Kasur Busa Royal Grand Exclusive 100cm Biru',
        price: 793000,
        averageCost: 600000,
        stockQty: 2,
      },
    });
    productId = product.id;

    const rentalItem = await rentalService.createItem(
      COMPANY_ID,
      {
        productId,
        dailyRate: 50000,
        weeklyRate: 300000,
        monthlyRate: 1000000,
        depositPolicyType: 'PER_UNIT',
        depositPerUnit: 300000,
      },
      ACTOR_ID
    );
    rentalItemId = rentalItem.id;
  });

  afterAll(async () => {
    await cleanup();
  });

  it('converts purchased stock into traceable rental units', async () => {
    const order = await prisma.order.create({
      data: {
        companyId: COMPANY_ID,
        partnerId: supplierId,
        type: OrderType.PURCHASE,
        status: OrderStatus.COMPLETED,
        orderNumber: 'PO-RENTAL-UNIT-SOURCE',
        date: new Date('2026-02-13T00:00:00.000Z'),
        totalAmount: 1200000,
        paymentTerms: PaymentTerms.NET_30,
        items: {
          create: {
            productId,
            quantity: 2,
            price: 600000,
          },
        },
      },
      include: { items: true },
    });

    const fulfillment = await prisma.fulfillment.create({
      data: {
        companyId: COMPANY_ID,
        orderId: order.id,
        type: FulfillmentType.RECEIPT,
        number: 'GRN-RENTAL-UNIT-SOURCE',
        date: new Date('2026-02-13T00:00:00.000Z'),
        status: DocumentStatus.POSTED,
        items: {
          create: {
            productId,
            orderItemId: order.items[0].id,
            quantity: 2,
            costSnapshot: 600000,
          },
        },
      },
    });

    const bill = await prisma.invoice.create({
      data: {
        companyId: COMPANY_ID,
        orderId: order.id,
        partnerId: supplierId,
        type: InvoiceType.BILL,
        status: InvoiceStatus.POSTED,
        invoiceNumber: 'BILL-RENTAL-UNIT-SOURCE',
        date: new Date('2026-02-13T00:00:00.000Z'),
        dueDate: new Date('2026-03-13T00:00:00.000Z'),
        amount: 1200000,
        subtotal: 1200000,
        taxAmount: 0,
        balance: 1200000,
      },
    });

    const convertedCount = await rentalService.convertStockToUnits(
      COMPANY_ID,
      rentalItemId,
      2,
      ACTOR_ID,
      {
        sourceOrderId: order.id,
        sourceFulfillmentId: fulfillment.id,
        sourceBillId: bill.id,
        sourceBatchCode: 'P002',
        unitCodes: ['UNIT-100-001', 'UNIT-100-002'],
        unitMetadata: [
          {
            color: 'biru',
            sizeLabel: '100cm',
            sourceNotes: 'Imported from rental supplier purchase P002',
          },
          {
            color: 'biru',
            sizeLabel: '100cm',
            sourceNotes: 'Imported from rental supplier purchase P002',
          },
        ],
      }
    );

    expect(convertedCount).toBe(2);

    const units = await prisma.rentalItemUnit.findMany({
      where: { companyId: COMPANY_ID, rentalItemId },
      orderBy: { unitCode: 'asc' },
    });
    expect(units).toHaveLength(2);
    expect(units[0]).toMatchObject({
      unitCode: 'UNIT-100-001',
      sourceOrderId: order.id,
      sourceOrderItemId: order.items[0].id,
      sourceFulfillmentId: fulfillment.id,
      sourceBillId: bill.id,
      sourceBatchCode: 'P002',
      sizeLabel: '100cm',
      color: 'biru',
    });
    expect(Number(units[0].acquisitionCost)).toBe(600000);
    expect(units[0].acquiredAt?.toISOString()).toBe(
      '2026-02-13T00:00:00.000Z'
    );

    const productAfterConversion = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });
    expect(productAfterConversion.stockQty).toBe(0);
  });

  it('tracks bill installments without creating payment or journal side effects', async () => {
    const bill = await prisma.invoice.create({
      data: {
        companyId: COMPANY_ID,
        partnerId: supplierId,
        type: InvoiceType.BILL,
        status: InvoiceStatus.POSTED,
        invoiceNumber: 'BILL-RENTAL-INSTALLMENT',
        date: new Date('2026-01-29T00:00:00.000Z'),
        dueDate: new Date('2026-07-29T00:00:00.000Z'),
        amount: 600000,
        subtotal: 600000,
        taxAmount: 0,
        balance: 600000,
      },
    });

    const schedule = await billInstallmentService.createSchedule(
      COMPANY_ID,
      {
        billId: bill.id,
        replaceExisting: false,
        installments: [
          { dueDate: new Date('2026-02-28T00:00:00.000Z'), amount: 200000 },
          { dueDate: new Date('2026-03-31T00:00:00.000Z'), amount: 200000 },
          { dueDate: new Date('2026-04-30T00:00:00.000Z'), amount: 200000 },
        ],
      }
    );

    expect(schedule).toHaveLength(3);
    expect(await prisma.payment.count({ where: { invoiceId: bill.id } })).toBe(
      0
    );

    const payment = await paymentService.create(COMPANY_ID, {
      invoiceId: bill.id,
      amount: 200000,
      method: PaymentMethodType.BANK,
      businessDate: new Date('2026-02-28T00:00:00.000Z'),
    });

    const paidInstallment = await billInstallmentService.markPaid(
      COMPANY_ID,
      {
        installmentId: schedule[0].id,
        paymentId: payment.id,
      }
    );

    expect(paidInstallment.status).toBe(BillInstallmentStatus.PAID);
    expect(paidInstallment.paymentId).toBe(payment.id);

    const billWithSummary = await billService.getById(bill.id, COMPANY_ID);
    expect(billWithSummary?.installmentSummary).toMatchObject({
      scheduledAmount: 600000,
      paidScheduledAmount: 200000,
      remainingScheduledAmount: 400000,
    });

    const billAfterPayment = await prisma.invoice.findUniqueOrThrow({
      where: { id: bill.id },
    });
    expect(Number(billAfterPayment.balance)).toBe(400000);
  });

  it('rejects installment totals above the bill amount', async () => {
    const bill = await prisma.invoice.create({
      data: {
        companyId: COMPANY_ID,
        partnerId: supplierId,
        type: InvoiceType.BILL,
        status: InvoiceStatus.POSTED,
        invoiceNumber: 'BILL-RENTAL-INSTALLMENT-OVER',
        dueDate: new Date('2026-02-28T00:00:00.000Z'),
        amount: 300000,
        subtotal: 300000,
        taxAmount: 0,
        balance: 300000,
      },
    });

    await expect(
      billInstallmentService.createSchedule(COMPANY_ID, {
        billId: bill.id,
        replaceExisting: false,
        installments: [
          { dueDate: new Date('2026-02-28T00:00:00.000Z'), amount: 200000 },
          { dueDate: new Date('2026-03-31T00:00:00.000Z'), amount: 200000 },
        ],
      })
    ).rejects.toThrow(/exceeds bill amount/i);
  });
});

async function cleanup() {
  await prisma.billInstallmentSchedule.deleteMany({
    where: { companyId: COMPANY_ID },
  });
  await prisma.auditLog.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN (SELECT id FROM "JournalEntry" WHERE "companyId" = ${COMPANY_ID})`;
  await prisma.journalEntry.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.payment.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.invoice.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.inventoryMovement.deleteMany({
    where: { companyId: COMPANY_ID },
  });
  await prisma.fulfillmentItem.deleteMany({
    where: { fulfillment: { companyId: COMPANY_ID } },
  });
  await prisma.fulfillment.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.rentalItemUnit.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.rentalItem.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.orderItem.deleteMany({
    where: { order: { companyId: COMPANY_ID } },
  });
  await prisma.order.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.product.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.account.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.company.deleteMany({ where: { id: COMPANY_ID } });
}
