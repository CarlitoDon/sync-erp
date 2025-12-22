import { describe, it, expect, beforeEach } from 'vitest';
import {
  prisma,
  InvoiceType,
  InvoiceStatus,
  PaymentMethod,
} from '@sync-erp/database';
import { asCorrelationId } from '@sync-erp/shared';
import { PaymentService } from '@modules/accounting/services/payment.service';

describe('Partial Payment Flow', () => {
  const paymentService = new PaymentService();

  let testCompanyId: string;
  let testPartnerId: string;

  beforeEach(async () => {
    // Find test company
    const company = await prisma.company.findFirst();
    if (!company) throw new Error('No company found for testing');
    testCompanyId = company.id;

    // Find or create test partner (supplier)
    let partner = await prisma.partner.findFirst({
      where: { companyId: testCompanyId, type: 'SUPPLIER' },
    });
    if (!partner) {
      partner = await prisma.partner.create({
        data: {
          companyId: testCompanyId,
          name: 'Test Supplier',
          email: 'test@supplier.com',
          type: 'SUPPLIER',
        },
      });
    }
    testPartnerId = partner.id;
  });

  it('should allow multiple partial payments on same invoice', async () => {
    // Create a bill directly (bypass PO flow to avoid audit log issues)
    const bill = await prisma.invoice.create({
      data: {
        companyId: testCompanyId,
        partnerId: testPartnerId,
        type: InvoiceType.BILL,
        status: InvoiceStatus.POSTED,
        invoiceNumber: `TEST-BILL-${Date.now()}`,
        amount: 1000000, // 1M
        balance: 1000000,
        taxAmount: 0,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    expect(Number(bill.balance)).toBe(1000000);

    // 1. Make FIRST partial payment (400k)
    const payment1 = await paymentService.create(
      testCompanyId,
      {
        invoiceId: bill.id,
        amount: 400000,
        method: PaymentMethod.BANK_TRANSFER,
        businessDate: new Date(),
      },
      asCorrelationId(`payment-1-${Date.now()}`)
    );
    expect(Number(payment1.amount)).toBe(400000);

    // Check balance after first payment
    const billAfterPayment1 = await prisma.invoice.findUnique({
      where: { id: bill.id },
    });
    expect(Number(billAfterPayment1!.balance)).toBe(600000);

    // 2. Make SECOND partial payment (300k)
    const payment2 = await paymentService.create(
      testCompanyId,
      {
        invoiceId: bill.id,
        amount: 300000,
        method: PaymentMethod.BANK_TRANSFER,
        businessDate: new Date(),
      },
      asCorrelationId(`payment-2-${Date.now()}`)
    );
    expect(Number(payment2.amount)).toBe(300000);

    // Check balance after second payment
    const billAfterPayment2 = await prisma.invoice.findUnique({
      where: { id: bill.id },
    });
    expect(Number(billAfterPayment2!.balance)).toBe(300000);

    // 3. Make THIRD partial payment (300k) - should complete
    const payment3 = await paymentService.create(
      testCompanyId,
      {
        invoiceId: bill.id,
        amount: 300000,
        method: PaymentMethod.BANK_TRANSFER,
        businessDate: new Date(),
      },
      asCorrelationId(`payment-3-${Date.now()}`)
    );
    expect(Number(payment3.amount)).toBe(300000);

    // Check final balance and status
    const billFinal = await prisma.invoice.findUnique({
      where: { id: bill.id },
    });
    expect(Number(billFinal!.balance)).toBe(0);
    expect(billFinal!.status).toBe(InvoiceStatus.PAID);

    // Verify 3 payments were recorded
    const allPayments = await prisma.payment.findMany({
      where: { invoiceId: bill.id },
    });
    expect(allPayments.length).toBe(3);
  });

  it('should reject payment exceeding balance', async () => {
    // Create a bill with small balance
    const bill = await prisma.invoice.create({
      data: {
        companyId: testCompanyId,
        partnerId: testPartnerId,
        type: InvoiceType.BILL,
        status: InvoiceStatus.POSTED,
        invoiceNumber: `TEST-BILL-SMALL-${Date.now()}`,
        amount: 50000,
        balance: 50000,
        taxAmount: 0,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Try to pay more than balance
    await expect(
      paymentService.create(
        testCompanyId,
        {
          invoiceId: bill.id,
          amount: 100000, // Bill is only 50k
          method: PaymentMethod.BANK_TRANSFER,
          businessDate: new Date(),
        },
        asCorrelationId(`payment-exceed-${Date.now()}`)
      )
    ).rejects.toThrow();
  });
});
