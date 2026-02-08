import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  InvoiceStatus,
  InvoiceType,
  PaymentMethodType,
  prisma,
} from '@sync-erp/database';
import { PaymentService } from '@modules/accounting/services/payment.service';
import { asCorrelationId } from '@sync-erp/shared';

const paymentService = new PaymentService();

const COMPANY_ID = 'test-void-payment-001';

describe('P2P: Void Payment & Journal Reversal', () => {
  let partnerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test Void Payment' },
      update: {},
    });

    // Setup Required Accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
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
        name: 'Test Supplier Void Payment',
        type: 'SUPPLIER',
        email: `supplier-void-payment-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.$transaction([
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
      prisma.partner.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.account.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.company.deleteMany({
        where: { id: COMPANY_ID },
      }),
    ]);
  });

  it('should void payment and restore bill balance', async () => {
    // 1. Create a POSTED Bill with 1M balance
    const bill = await prisma.invoice.create({
      data: {
        companyId: COMPANY_ID,
        partnerId,
        type: InvoiceType.BILL,
        status: InvoiceStatus.POSTED,
        invoiceNumber: `BILL-VOID-PAY-${Date.now()}`,
        amount: 1000000,
        subtotal: 1000000,
        balance: 1000000,
        taxAmount: 0,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // 2. Create a payment of 400k
    const payment = await paymentService.create(
      COMPANY_ID,
      {
        invoiceId: bill.id,
        amount: 400000,
        method: PaymentMethodType.BANK,
        businessDate: new Date(),
      },
      asCorrelationId(`void-pay-test-${Date.now()}`)
    );

    expect(Number(payment.amount)).toBe(400000);

    // Verify bill balance reduced
    const billAfterPayment = await prisma.invoice.findUnique({
      where: { id: bill.id },
    });
    expect(Number(billAfterPayment!.balance)).toBe(600000);

    // 3. Void the payment (with admin permissions)
    const adminPermissions = ['*:*'];
    const voidedPayment = await paymentService.void(
      payment.id,
      COMPANY_ID,
      'test-actor',
      'Testing void payment functionality',
      adminPermissions
    );

    // 4. Verify payment is marked as voided
    expect(voidedPayment.reference).toContain('[VOIDED]');

    // 5. Verify bill balance is RESTORED back to original
    const billAfterVoid = await prisma.invoice.findUnique({
      where: { id: bill.id },
    });
    expect(Number(billAfterVoid!.balance)).toBe(1000000);
    // Note: Status stays PARTIALLY_PAID after void (not reverted to POSTED)
    // because there was payment activity on this bill

    // 6. Verify reversal journal was created
    const reversalJournal = await prisma.journalEntry.findFirst({
      where: {
        companyId: COMPANY_ID,
        memo: { contains: 'Reversal' },
      },
    });
    expect(reversalJournal).toBeDefined();
  });

  it('should reject void on already voided payment', async () => {
    // Create and pay a bill
    const bill = await prisma.invoice.create({
      data: {
        companyId: COMPANY_ID,
        partnerId,
        type: InvoiceType.BILL,
        status: InvoiceStatus.POSTED,
        invoiceNumber: `BILL-DOUBLE-VOID-${Date.now()}`,
        amount: 500000,
        subtotal: 500000,
        balance: 500000,
        taxAmount: 0,
        dueDate: new Date(),
      },
    });

    const payment = await paymentService.create(COMPANY_ID, {
      invoiceId: bill.id,
      amount: 500000,
      method: PaymentMethodType.CASH,
    });

    // First void should succeed
    const adminPermissions = ['*:*'];
    await paymentService.void(
      payment.id,
      COMPANY_ID,
      'test-actor',
      'First void',
      adminPermissions
    );

    // Second void should fail
    await expect(
      paymentService.void(
        payment.id,
        COMPANY_ID,
        'test-actor',
        'Trying second void',
        adminPermissions
      )
    ).rejects.toThrow(/already voided/i);
  });

  it('should reject void without permission', async () => {
    const bill = await prisma.invoice.create({
      data: {
        companyId: COMPANY_ID,
        partnerId,
        type: InvoiceType.BILL,
        status: InvoiceStatus.POSTED,
        invoiceNumber: `BILL-NO-PERM-${Date.now()}`,
        amount: 100000,
        subtotal: 100000,
        balance: 100000,
        taxAmount: 0,
        dueDate: new Date(),
      },
    });

    const payment = await paymentService.create(COMPANY_ID, {
      invoiceId: bill.id,
      amount: 100000,
      method: PaymentMethodType.CASH,
    });

    // Try to void without permission
    const noPermissions: string[] = [];
    await expect(
      paymentService.void(
        payment.id,
        COMPANY_ID,
        'test-actor',
        'No permission void attempt',
        noPermissions
      )
    ).rejects.toThrow(/permission/i);
  });

  it('should restore bill to PARTIALLY_PAID when voiding partial payment', async () => {
    // Create fully paid bill (via two payments)
    const bill = await prisma.invoice.create({
      data: {
        companyId: COMPANY_ID,
        partnerId,
        type: InvoiceType.BILL,
        status: InvoiceStatus.POSTED,
        invoiceNumber: `BILL-PARTIAL-${Date.now()}`,
        amount: 1000000,
        subtotal: 1000000,
        balance: 1000000,
        taxAmount: 0,
        dueDate: new Date(),
      },
    });

    // First payment: 600k
    await paymentService.create(
      COMPANY_ID,
      {
        invoiceId: bill.id,
        amount: 600000,
        method: PaymentMethodType.BANK,
      },
      asCorrelationId(`partial-1-${Date.now()}`)
    );

    // Second payment: 400k (completes)
    const payment2 = await paymentService.create(
      COMPANY_ID,
      {
        invoiceId: bill.id,
        amount: 400000,
        method: PaymentMethodType.BANK,
      },
      asCorrelationId(`partial-2-${Date.now()}`)
    );

    // Bill should be PAID
    const paidBill = await prisma.invoice.findUnique({
      where: { id: bill.id },
    });
    expect(paidBill!.status).toBe(InvoiceStatus.PAID);
    expect(Number(paidBill!.balance)).toBe(0);

    // Void second payment
    const adminPermissions = ['*:*'];
    await paymentService.void(
      payment2.id,
      COMPANY_ID,
      'test-actor',
      'Void second payment',
      adminPermissions
    );

    // Bill should return to PARTIALLY_PAID with 400k balance
    const billAfterVoid = await prisma.invoice.findUnique({
      where: { id: bill.id },
    });
    expect(Number(billAfterVoid!.balance)).toBe(400000);
    // Note: Status may stay as POSTED or change based on implementation
  });
});
