import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  CashTransactionStatus,
  CashTransactionType,
  AccountType,
} from '@sync-erp/database';
import { CashBankService } from '../../src/modules/cash-bank/cash-bank.service';
import { CashBankRepository } from '../../src/modules/cash-bank/cash-bank.repository';
import { AccountService } from '../../src/modules/accounting/services/account.service';
import { JournalService } from '../../src/modules/accounting/services/journal.service';

// Initialize services
const repository = new CashBankRepository();
const accountService = new AccountService();
const journalService = new JournalService();
const cashBankService = new CashBankService(
  repository,
  accountService,
  journalService
);

const COMPANY_ID = 'test-cash-bank-integration';
const ACTOR_ID = 'test-user-001';

describe('Feature 042: Cash & Bank Integration', () => {
  let expenseAccountId: string;
  let revenueAccountId: string;
  let bankAccount1Id: string;
  let bankAccount2Id: string;

  beforeAll(async () => {
    // 1. Setup Company
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Test Cash Bank Company',
      },
      update: {},
    });

    // 2. Setup GL Accounts for allocation
    const expenseAcc = await prisma.account.upsert({
      where: {
        companyId_code: { companyId: COMPANY_ID, code: '6000' },
      },
      create: {
        companyId: COMPANY_ID,
        code: '6000',
        name: 'General Expense',
        type: AccountType.EXPENSE,
      },
      update: {},
    });
    expenseAccountId = expenseAcc.id;

    const revenueAcc = await prisma.account.upsert({
      where: {
        companyId_code: { companyId: COMPANY_ID, code: '4000' },
      },
      create: {
        companyId: COMPANY_ID,
        code: '4000',
        name: 'General Revenue',
        type: AccountType.REVENUE,
      },
      update: {},
    });
    revenueAccountId = revenueAcc.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.$transaction([
      prisma.cashTransactionItem.deleteMany({
        where: {
          transaction: {
            companyId: { in: [COMPANY_ID, 'other-company-id'] },
          },
        },
      }),
      prisma.cashTransaction.deleteMany({
        where: {
          companyId: { in: [COMPANY_ID, 'other-company-id'] },
        },
      }),
      prisma.bankAccount.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.journalLine.deleteMany({
        where: { journal: { companyId: COMPANY_ID } },
      }),
      prisma.journalEntry.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.account.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.deleteMany({
        where: { id: { in: [COMPANY_ID, 'other-company-id'] } },
      }),
    ]);
  });

  describe('US1: Manage Bank Accounts', () => {
    it('should create a bank account and automatically create a sub-account of 1200 Bank', async () => {
      // Need to seed default accounts first to have 1200 and 1100
      await accountService.seedDefaultAccounts(COMPANY_ID);

      const bankAcc = await cashBankService.createAccount(
        COMPANY_ID,
        {
          bankName: 'Test Bank IDR',
          accountNumber: '123456789',
          currency: 'IDR',
          accountType: 'BANK',
        }
      );

      expect(bankAcc.bankName).toBe('Test Bank IDR');
      expect(bankAcc.account).toBeDefined();
      expect(bankAcc.account.code).toBe('1201'); // First sub-account of 1200
      expect(bankAcc.account.parentId).toBeDefined(); // Should have parent
      expect(bankAcc.account.type).toBe(AccountType.ASSET);

      bankAccount1Id = bankAcc.id;
    });

    it('should create a cash account and automatically create a sub-account of 1100 Cash', async () => {
      const bankAcc = await cashBankService.createAccount(
        COMPANY_ID,
        {
          bankName: 'Petty Cash',
          currency: 'IDR',
          accountType: 'CASH',
        }
      );

      expect(bankAcc.bankName).toBe('Petty Cash');
      expect(bankAcc.account.code).toBe('1101'); // First sub-account of 1100
      expect(bankAcc.account.parentId).toBeDefined();

      bankAccount2Id = bankAcc.id;
    });
  });

  describe('US2: Spend Money (Expense)', () => {
    it('should create a draft SPEND transaction with multiple items', async () => {
      const tx = await cashBankService.createTransaction(COMPANY_ID, {
        type: CashTransactionType.SPEND,
        date: new Date(),
        sourceBankAccountId: bankAccount1Id,
        payee: 'Office Supplies Store',
        description: 'Office supplies and snacks',
        items: [
          {
            accountId: expenseAccountId,
            amount: 50000,
            description: 'Paper and pens',
          },
          {
            accountId: expenseAccountId,
            amount: 25000,
            description: 'Coffee and tea',
          },
        ],
      });

      expect(tx.type).toBe(CashTransactionType.SPEND);
      expect(tx.status).toBe(CashTransactionStatus.DRAFT);
      expect(Number(tx.amount)).toBe(75000);
      expect(tx.items).toHaveLength(2);
    });

    it('should post SPEND transaction and create journal entry', async () => {
      const draftTx = await prisma.cashTransaction.findFirst({
        where: {
          companyId: COMPANY_ID,
          type: CashTransactionType.SPEND,
        },
      });

      const postedTx = await cashBankService.postTransaction(
        draftTx!.id,
        COMPANY_ID,
        ACTOR_ID
      );

      expect(postedTx.status).toBe(CashTransactionStatus.POSTED);
      expect(postedTx.journalEntryId).toBeDefined();

      const journal = await prisma.journalEntry.findUnique({
        where: { id: postedTx.journalEntryId! },
        include: { lines: true },
      });

      expect(journal).toBeDefined();
      expect(journal?.lines).toHaveLength(3); // 2 expenses + 1 bank

      // Bank account 1 should be credited (Cash out)
      const bankLine = journal?.lines.find(
        (l) => l.accountId === (postedTx as unknown as { sourceBank: { accountId: string }; destinationBank: { accountId: string } }).sourceBank.accountId
      );
      expect(Number(bankLine?.credit)).toBe(75000);
      expect(Number(bankLine?.debit)).toBe(0);

      // Expense account should be debited
      const expenseLines = journal?.lines.filter(
        (l) => l.accountId === expenseAccountId
      );
      expect(expenseLines).toHaveLength(2);
      const totalDebit = expenseLines?.reduce(
        (sum, l) => sum + Number(l.debit),
        0
      );
      expect(totalDebit).toBe(75000);
    });
  });

  describe('US3: Receive Money (Income)', () => {
    it('should create and post a RECEIVE transaction', async () => {
      const tx = await cashBankService.createTransaction(COMPANY_ID, {
        type: CashTransactionType.RECEIVE,
        date: new Date(),
        destinationBankAccountId: bankAccount1Id,
        payee: 'Client A',
        items: [
          {
            accountId: revenueAccountId,
            amount: 500000,
            description: 'Consulting fee',
          },
        ],
      });

      const postedTx = await cashBankService.postTransaction(
        tx.id,
        COMPANY_ID,
        ACTOR_ID
      );

      expect(postedTx.status).toBe(CashTransactionStatus.POSTED);

      const journal = await prisma.journalEntry.findUnique({
        where: { id: postedTx.journalEntryId! },
        include: { lines: true },
      });

      // Bank account 1 should be debited (Cash in)
      const bankLine = journal?.lines.find(
        (l) =>
          l.accountId === (postedTx as unknown as { sourceBank: { accountId: string }; destinationBank: { accountId: string } }).destinationBank.accountId
      );
      expect(Number(bankLine?.debit)).toBe(500000);

      // Revenue account should be credited
      const revenueLine = journal?.lines.find(
        (l) => l.accountId === revenueAccountId
      );
      expect(Number(revenueLine?.credit)).toBe(500000);
    });
  });

  describe('US4: Transfer Funds', () => {
    it('should create and post a TRANSFER transaction', async () => {
      const tx = await cashBankService.createTransaction(COMPANY_ID, {
        type: CashTransactionType.TRANSFER,
        date: new Date(),
        sourceBankAccountId: bankAccount1Id,
        destinationBankAccountId: bankAccount2Id,
        amount: 100000,
        description: 'Atmospheric transfer to petty cash',
      });

      const postedTx = await cashBankService.postTransaction(
        tx.id,
        COMPANY_ID,
        ACTOR_ID
      );

      expect(postedTx.status).toBe(CashTransactionStatus.POSTED);

      const journal = await prisma.journalEntry.findUnique({
        where: { id: postedTx.journalEntryId! },
        include: { lines: true },
      });

      // Source bank (Bank 1) should be credited
      const sourceLine = journal?.lines.find(
        (l) => l.accountId === (postedTx as unknown as { sourceBank: { accountId: string }; destinationBank: { accountId: string } }).sourceBank.accountId
      );
      expect(Number(sourceLine?.credit)).toBe(100000);

      // Destination bank (Bank 2) should be debited
      const destLine = journal?.lines.find(
        (l) =>
          l.accountId === (postedTx as unknown as { sourceBank: { accountId: string }; destinationBank: { accountId: string } }).destinationBank.accountId
      );
      expect(Number(destLine?.debit)).toBe(100000);
    });
  });

  describe('Edge Cases & Validations', () => {
    it('should fail to create TRANSFER with same source and destination', async () => {
      await expect(
        cashBankService.createTransaction(COMPANY_ID, {
          type: CashTransactionType.TRANSFER,
          date: new Date(),
          sourceBankAccountId: bankAccount1Id,
          destinationBankAccountId: bankAccount1Id,
          amount: 1000,
        })
      ).rejects.toThrow(
        /Source and destination accounts must be different/
      );
    });

    it('should fail to create TRANSFER with zero or negative amount', async () => {
      await expect(
        cashBankService.createTransaction(COMPANY_ID, {
          type: CashTransactionType.TRANSFER,
          date: new Date(),
          sourceBankAccountId: bankAccount1Id,
          destinationBankAccountId: bankAccount2Id,
          amount: 0,
        })
      ).rejects.toThrow(/A positive amount is required/);
    });

    it('should fail to create SPEND without items', async () => {
      await expect(
        cashBankService.createTransaction(COMPANY_ID, {
          type: CashTransactionType.SPEND,
          date: new Date(),
          sourceBankAccountId: bankAccount1Id,
          items: [],
        })
      ).rejects.toThrow(/Expense items are required/);
    });

    it('should fail to create RECEIVE without items', async () => {
      await expect(
        cashBankService.createTransaction(COMPANY_ID, {
          type: CashTransactionType.RECEIVE,
          date: new Date(),
          destinationBankAccountId: bankAccount1Id,
          items: [],
        })
      ).rejects.toThrow(/Income items are required/);
    });

    it('should fail to post an already posted transaction', async () => {
      // Create and post
      const tx = await cashBankService.createTransaction(COMPANY_ID, {
        type: CashTransactionType.TRANSFER,
        date: new Date(),
        sourceBankAccountId: bankAccount1Id,
        destinationBankAccountId: bankAccount2Id,
        amount: 5000,
      });
      await cashBankService.postTransaction(
        tx.id,
        COMPANY_ID,
        ACTOR_ID
      );

      // Try post again
      await expect(
        cashBankService.postTransaction(tx.id, COMPANY_ID, ACTOR_ID)
      ).rejects.toThrow(/Only DRAFT transactions can be posted/);
    });

    it('should prevent cross-company access', async () => {
      const OTHER_COMPANY = 'other-company-id';

      // Create transaction in COMPANY_ID
      const tx = await cashBankService.createTransaction(COMPANY_ID, {
        type: CashTransactionType.SPEND,
        date: new Date(),
        sourceBankAccountId: bankAccount1Id,
        items: [{ accountId: expenseAccountId, amount: 100 }],
      });

      // Try post using OTHER_COMPANY
      await expect(
        cashBankService.postTransaction(
          tx.id,
          OTHER_COMPANY,
          ACTOR_ID
        )
      ).rejects.toThrow(/Transaction not found/);
    });

    it('should fail to create SPEND with destination bank specified', async () => {
      await expect(
        cashBankService.createTransaction(COMPANY_ID, {
          type: CashTransactionType.SPEND,
          date: new Date(),
          sourceBankAccountId: bankAccount1Id,
          destinationBankAccountId: bankAccount2Id,
          items: [{ accountId: expenseAccountId, amount: 100 }],
        })
      ).rejects.toThrow(/Destination bank account must be empty/);
    });
  });
});
