import { Router } from 'express';
import { AccountingController } from '../modules/accounting/controllers/accounting.controller';
import { z } from 'zod'; // Keep zod schemas for validation if controller doesn't handle it fully?
// Controller uses service which accepts raw args or partials.
// Legacy routes did validation inline. New Controller uses inline validation?
// Controller methods I wrote: createAccount(body), createJournal(body).
// They pass body to service. Service types args.
// I should keep Zod validation in routes OR move to controller.
// My Controller methods implemented: `this.accountService.create(companyId, req.body)`.
// `accountService.create` expects `{ code: string; name: string... }`.
// If I remove Zod from route, I rely on TS or Runtime check in Service? Service doesn't validate strictly (Prisma throws).
// Better to keep Zod in routes for now.

export const financeRouter = Router();
const controller = new AccountingController();

const CreateAccountSchema = z.object({
  code: z.string().min(3).max(10),
  name: z.string().min(1),
  type: z.enum([
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'REVENUE',
    'EXPENSE',
  ]),
});

// ========== ACCOUNTS ==========

// GET /api/finance/accounts - List accounts
financeRouter.get('/accounts', controller.listAccounts);

// POST /api/finance/accounts - Create account
financeRouter.post('/accounts', async (req, res, next) => {
  try {
    CreateAccountSchema.parse(req.body);
    await controller.createAccount(req, res, next);
  } catch (error) {
    next(error);
  }
});

// POST /api/finance/accounts/seed - Seed default chart of accounts
financeRouter.post('/accounts/seed', controller.seedAccounts);

// ========== JOURNALS ==========

// GET /api/finance/journals - List journal entries
financeRouter.get('/journals', controller.listJournals);

// GET /api/finance/journals/:id - Get journal entry // Was missing in Controller? No, check Controller.
// Controller has listJournals, createJournal. getById was missing in my Controller snippet?
// Let me check AccountingController content.
// Step 1265: createJournal, listJournals. getById WAS MISSING!
// I need to add getById to AccountingController before updating route!
// And getById for Journal?
// I will keep existing inline handler for getById if Controller misses it, or update Controller.
// I prefer updating Controller.
// Wait, I can't update Controller easily in parallel.
// I'll update Controller first.

// ========== REPORTS ==========

// GET /api/finance/reports/trial-balance
financeRouter.get(
  '/reports/trial-balance',
  controller.getTrialBalance
);

// GET /api/finance/reports/general-ledger/:accountId
financeRouter.get(
  '/reports/general-ledger/:accountId',
  controller.getGeneralLedger
);

// GET /api/finance/reports/income-statement
financeRouter.get(
  '/reports/income-statement',
  controller.getIncomeStatement
);
