import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  InvoiceStatus,
  InvoiceType,
  PaymentMethodType,
  prisma,
} from '@sync-erp/database';
import { PaymentService } from '../../src/modules/accounting/services/payment.service';
import { asCorrelationId } from '@sync-erp/shared';

const paymentService = new PaymentService();

const COMPANY_ID = 'test-void-receipt-001';

describe('O2C: Void Receipt & Journal Reversal (Mirroring P2P)', () => {
  let partnerId: string;

  beforeAll(async () => {
    // Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test Void Receipt' },
      update: {},
    });

    // Setup Required Accounts (O2C: AR instead of AP)
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
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

    // Setup Customer (not Supplier)
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Customer Void Receipt',
        type: 'CUSTOMER',
        email: `customer-void-receipt-${Date.now()}@test.com`,
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

  it('should void receipt and restore invoice balance', async () => {
    // 1. Create a POSTED Invoice with 1M balance
    const invoice = await prisma.invoice.create({
      data: {
        companyId: COMPANY_ID,
        partnerId,
        type: InvoiceType.INVOICE,
        status: InvoiceStatus.POSTED,
        invoiceNumber: `INV-VOID-REC-${Date.now()}`,
        amount: 1000000,
        subtotal: 1000000,
        balance: 1000000,
        taxAmount: 0,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // 2. Create a payment (receipt) of 400k
    const payment = await paymentService.create(
      COMPANY_ID,
      {
        invoiceId: invoice.id,
        amount: 400000,
        method: PaymentMethodType.BANK,
        businessDate: new Date(),
      },
      asCorrelationId(`void-rec-test-${Date.now()}`)
    );

    expect(Number(payment.amount)).toBe(400000);

    // Verify invoice balance reduced
    const invoiceAfterPayment = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });
    expect(Number(invoiceAfterPayment!.balance)).toBe(600000);

    // 3. Void the receipt (with admin permissions)
    const adminPermissions = ['*:*'];
    const voidedPayment = await paymentService.void(
      payment.id,
      COMPANY_ID,
      'test-actor',
      'Testing void receipt functionality',
      adminPermissions
    );

    // 4. Verify payment is marked as voided
    expect(voidedPayment.reference).toContain('[VOIDED]');

    // 5. Verify invoice balance is RESTORED back to original
    const invoiceAfterVoid = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });
    expect(Number(invoiceAfterVoid!.balance)).toBe(1000000);

    // 6. Verify reversal journal was created (Dr AR, Cr Cash)
    const reversalJournal = await prisma.journalEntry.findFirst({
      where: {
        companyId: COMPANY_ID,
        memo: { contains: 'Reversal' },
      },
    });
    expect(reversalJournal).toBeDefined();
  });

  it('should reject void on already voided receipt', async () => {
    // Create and pay an invoice
    const invoice = await prisma.invoice.create({
      data: {
        companyId: COMPANY_ID,
        partnerId,
        type: InvoiceType.INVOICE,
        status: InvoiceStatus.POSTED,
        invoiceNumber: `INV-DOUBLE-VOID-${Date.now()}`,
        amount: 500000,
        subtotal: 500000,
        balance: 500000,
        taxAmount: 0,
        dueDate: new Date(),
      },
    });

    const payment = await paymentService.create(COMPANY_ID, {
      invoiceId: invoice.id,
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
    const invoice = await prisma.invoice.create({
      data: {
        companyId: COMPANY_ID,
        partnerId,
        type: InvoiceType.INVOICE,
        status: InvoiceStatus.POSTED,
        invoiceNumber: `INV-NO-PERM-${Date.now()}`,
        amount: 100000,
        subtotal: 100000,
        balance: 100000,
        taxAmount: 0,
        dueDate: new Date(),
      },
    });

    const payment = await paymentService.create(COMPANY_ID, {
      invoiceId: invoice.id,
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

  it('should restore invoice to PARTIALLY_PAID when voiding partial receipt', async () => {
    // Create fully paid invoice (via two receipts)
    const invoice = await prisma.invoice.create({
      data: {
        companyId: COMPANY_ID,
        partnerId,
        type: InvoiceType.INVOICE,
        status: InvoiceStatus.POSTED,
        invoiceNumber: `INV-PARTIAL-${Date.now()}`,
        amount: 1000000,
        subtotal: 1000000,
        balance: 1000000,
        taxAmount: 0,
        dueDate: new Date(),
      },
    });

    // First receipt: 600k
    await paymentService.create(
      COMPANY_ID,
      {
        invoiceId: invoice.id,
        amount: 600000,
        method: PaymentMethodType.BANK,
      },
      asCorrelationId(`partial-1-${Date.now()}`)
    );

    // Second receipt: 400k (completes)
    const payment2 = await paymentService.create(
      COMPANY_ID,
      {
        invoiceId: invoice.id,
        amount: 400000,
        method: PaymentMethodType.BANK,
      },
      asCorrelationId(`partial-2-${Date.now()}`)
    );

    // Invoice should be PAID
    const paidInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });
    expect(paidInvoice!.status).toBe(InvoiceStatus.PAID);
    expect(Number(paidInvoice!.balance)).toBe(0);

    // Void second receipt
    const adminPermissions = ['*:*'];
    await paymentService.void(
      payment2.id,
      COMPANY_ID,
      'test-actor',
      'Void second receipt',
      adminPermissions
    );

    // Invoice should return to with 400k balance
    const invoiceAfterVoid = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });
    expect(Number(invoiceAfterVoid!.balance)).toBe(400000);
  });
});
