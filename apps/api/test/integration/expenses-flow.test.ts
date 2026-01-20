import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createContext } from '../../src/trpc/context';
import { appRouter } from '../../src/trpc/router';
import {
  prisma,
  InvoiceType,
  InvoiceStatus,
} from '@sync-erp/database';

const TEST_COMPANY_ID = 'test-expenses-flow-001';

describe('Expenses Flow', () => {
  let ctx: any;
  let caller: any;
  let companyId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Setup self-contained test data
    companyId = TEST_COMPANY_ID;

    // Create company
    await prisma.company.upsert({
      where: { id: companyId },
      create: { id: companyId, name: 'Test Expenses Company' },
      update: {},
    });

    // Create required accounts
    const accounts = [
      { code: '1100', name: 'Cash', type: 'ASSET' },
      { code: '1200', name: 'Bank', type: 'ASSET' },
      { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
      { code: '6100', name: 'General Expense', type: 'EXPENSE' }, // Required for expenses!
    ];

    for (const acc of accounts) {
      await prisma.account.upsert({
        where: {
          companyId_code: { companyId, code: acc.code },
        },
        update: {},
        create: {
          companyId,
          code: acc.code,
          name: acc.name,
          type: acc.type as any,
          isActive: true,
        },
      });
    }

    // Create partner
    const partner = await prisma.partner.create({
      data: {
        companyId,
        name: 'Test Expense Partner',
        type: 'SUPPLIER',
        email: `expense-test-${Date.now()}@test.com`,
      },
    });
    partnerId = partner.id;

    ctx = await createContext({
      info: {} as any,
      req: {
        headers: {
          'x-company-id': companyId,
        },
        context: {
          userId: 'test-user-id',
          idempotencyKey: undefined,
          companyId,
        },
      } as any,
      res: {} as any,
    });
    ctx.session = {
      companyId,
      userId: 'test-user',
      businessShape: { type: 'goods' },
    };
    ctx.companyId = companyId;

    caller = appRouter.createCaller(ctx);
  });

  afterAll(async () => {
    // Cleanup in proper FK order
    await prisma
      .$transaction([
        prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN (SELECT id FROM "JournalEntry" WHERE "companyId" = ${TEST_COMPANY_ID})`,
        prisma.journalEntry.deleteMany({
          where: { companyId: TEST_COMPANY_ID },
        }),
        prisma.payment.deleteMany({
          where: { companyId: TEST_COMPANY_ID },
        }),
        prisma.invoice.deleteMany({
          where: { companyId: TEST_COMPANY_ID },
        }),
        prisma.account.deleteMany({
          where: { companyId: TEST_COMPANY_ID },
        }),
        prisma.partner.deleteMany({
          where: { companyId: TEST_COMPANY_ID },
        }),
        prisma.company.delete({ where: { id: TEST_COMPANY_ID } }),
      ])
      .catch(() => {}); // Ignore cleanup errors
  });

  it('should create and post an expense', async () => {
    // 1. Create Expense
    const input = {
      partnerId,
      date: new Date(),
      reference: 'TEST-EXP-001',
      items: [
        { description: 'Office Supplies', quantity: 5, price: 100 }, // Total 500
        { description: 'Coffee', quantity: 2, price: 50 }, // Total 100
      ],
      // taxRate optional
    };

    const expense = await caller.expense.create(input);

    expect(expense).toBeDefined();
    expect(expense.type).toBe(InvoiceType.EXPENSE);
    expect(expense.status).toBe(InvoiceStatus.DRAFT);
    expect(Number(expense.amount)).toBe(600); // 500 + 100
    expect(expense.invoiceNumber).toBeDefined();

    // 2. List Expenses
    const list = await caller.expense.list();
    expect(list).toBeDefined();
    expect(list.find((e: any) => e.id === expense.id)).toBeDefined();

    // 3. Post Expense
    const posted = await caller.expense.post(expense.id);
    expect(posted.status).toBe(InvoiceStatus.POSTED);

    // 4. Verify Journal Entries
    const je = await prisma.journalEntry.findFirst({
      where: {
        sourceId: expense.id,
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    expect(je).toBeDefined();
    expect(je?.lines.length).toBeGreaterThanOrEqual(2);

    // Check lines (Dr Expense 6100, Cr AP 2100)
    const debitLine = je?.lines.find((l) => Number(l.debit) > 0);
    const creditLine = je?.lines.find((l) => Number(l.credit) > 0);

    // Note: Account codes might differ in seed, checking logic
    expect(Number(debitLine?.debit)).toBe(600);
    expect(Number(creditLine?.credit)).toBe(600);
    // Optionally check account codes if known (6100 and 2100 from service)
    expect(debitLine?.account?.code).toBe('6100');
    expect(creditLine?.account?.code).toBe('2100');
  });

  describe('Edge Cases', () => {
    it('should fail to create expense without items', async () => {
      const input = {
        partnerId,
        date: new Date(),
        reference: 'FAIL-NO-ITEMS',
        items: [], // Service throws 'Expense must have items'
      };

      await expect(caller.expense.create(input)).rejects.toThrow(
        'items'
      );
    });

    it('should fail to create expense with negative values', async () => {
      const input = {
        partnerId,
        date: new Date(),
        items: [
          { description: 'Bad math', quantity: -1, price: 100 },
        ],
      };
      // Zod validation should catch this before service
      await expect(caller.expense.create(input)).rejects.toThrow();
    });

    it('should fail to post non-existent expense', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(caller.expense.post(fakeId)).rejects.toThrow(
        'not found'
      );
    });

    it('should fail to post an already posted expense', async () => {
      // 1. Create valid expense
      const input = {
        partnerId,
        date: new Date(),
        reference: 'DOUBLE-POST',
        items: [{ description: 'Test', quantity: 1, price: 10 }],
      };
      const expense = await caller.expense.create(input);

      // 2. Post it once
      await caller.expense.post(expense.id);

      // 3. Try post again
      await expect(caller.expense.post(expense.id)).rejects.toThrow(
        'already posted'
      );
    });
  });
});
