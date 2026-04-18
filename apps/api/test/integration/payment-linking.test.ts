import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  InvoiceStatus,
  InvoiceType,
} from '@sync-erp/database';
import { CashBankService } from '../../src/modules/cash-bank/cash-bank.service';
import { CashBankRepository } from '../../src/modules/cash-bank/cash-bank.repository';
import { AccountService } from '../../src/modules/accounting/services/account.service';
import { PaymentService } from '../../src/modules/accounting/services/payment.service';
import { PaymentRepository } from '../../src/modules/accounting/repositories/payment.repository';
import { InvoiceRepository } from '../../src/modules/accounting/repositories/invoice.repository';
import { JournalService } from '../../src/modules/accounting/services/journal.service';

// Initialize services
const accountService = new AccountService();
const journalService = new JournalService();
const cashBankRepository = new CashBankRepository();
const cashBankService = new CashBankService(
  cashBankRepository,
  accountService,
  journalService
);
const paymentRepository = new PaymentRepository();
const invoiceRepository = new InvoiceRepository();
const paymentService = new PaymentService(
  paymentRepository,
  invoiceRepository,
  undefined, // Idempotency
  journalService,
  cashBankRepository // New dependency
);

const COMPANY_ID = 'test-payment-linking';

describe('Feature: Payment Linking to Bank Accounts', () => {
  let bankAccountId: string;
  let bankAccountCode: string;
  let supplierId: string;
  let billId: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Test Payment Linking' },
      update: {},
    });

    // 2. Setup Default Accounts (1100, 1200, 2100)
    await accountService.seedDefaultAccounts(COMPANY_ID);

    // 3. Create a specific Bank Account (e.g. 1201)
    const bankAcc = await cashBankService.createAccount(COMPANY_ID, {
      bankName: 'Test Bank BCA',
      accountNumber: '8888',
      currency: 'IDR',
      accountType: 'BANK',
    });
    bankAccountId = bankAcc.id;
    bankAccountCode = bankAcc.account.code; // Should be 1201

    // 4. Create Supplier
    const supplier = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Supplier',
        type: 'SUPPLIER',
      },
    });
    supplierId = supplier.id;
  });

  afterAll(async () => {
    await prisma.$transaction([
      prisma.payment.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.invoice.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.bankAccount.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.journalEntry.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.account.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.deleteMany({ where: { id: COMPANY_ID } }),
    ]);
  });

  it('should pay a bill using a specific bank account and record journal against it', async () => {
    // 1. Create a Bill
    const bill = await invoiceRepository.create({
      companyId: COMPANY_ID,
      partnerId: supplierId,
      type: InvoiceType.BILL,
      dueDate: new Date(),
      amount: 100000,
      balance: 100000,
      status: InvoiceStatus.POSTED,
      invoiceNumber: 'BILL-001',
    });
    billId = bill.id;

    // 2. Record Payment linking to Bank Account
    const payment = await paymentService.create(COMPANY_ID, {
      invoiceId: billId,
      amount: 100000,
      method: 'BANK', // Enum value
      bankAccountId: bankAccountId,
      businessDate: new Date(),
    });

    expect(payment).toBeDefined();
    expect(payment.accountId).toBe(bankAccountId);
    expect(Number(payment.amount)).toBe(100000);

    // 3. Verify Journal Entry
    // Find journal linked to payment
    const journal = await prisma.journalEntry.findFirst({
      where: {
        sourceId: payment.id,
        companyId: COMPANY_ID,
      },
      include: { lines: { include: { account: true } } },
    });

    expect(journal).toBeDefined();
    const creditLine = journal!.lines.find(
      (l) => Number(l.credit) > 0
    );
    const debitLine = journal!.lines.find((l) => Number(l.debit) > 0);

    // Credit should be to the specific Bank Account (1201), NOT generic 1200
    expect(creditLine).toBeDefined();
    expect(creditLine!.account.code).toBe(bankAccountCode); // 1201
    expect(Number(creditLine!.credit)).toBe(100000);

    // Debit AP (2100)
    expect(debitLine).toBeDefined();
    expect(debitLine!.account.code).toBe('2100');
  });

  it('should void the payment and reverse journal correctly', async () => {
    // 1. Void the payment
    const payment = await prisma.payment.findFirst({
      where: { invoiceId: billId },
    });

    await paymentService.void(
      payment!.id,
      COMPANY_ID,
      'user-1',
      'Mistake',
      ['FINANCE:VOID']
    );

    // 2. Verify Reversal Journal
    const reversalJournal = await prisma.journalEntry.findFirst({
      where: {
        sourceId: `${payment!.id}:reversal`,
        companyId: COMPANY_ID,
      },
      include: { lines: { include: { account: true } } },
    });

    expect(reversalJournal).toBeDefined();

    // Reverse Payment Made: Dr Bank 1201, Cr AP 2100

    const debitLine = reversalJournal!.lines.find(
      (l) => Number(l.debit) > 0
    );
    const creditLine = reversalJournal!.lines.find(
      (l) => Number(l.credit) > 0
    );

    expect(debitLine!.account.code).toBe(bankAccountCode); // 1201
    expect(creditLine!.account.code).toBe('2100');
  });
});
