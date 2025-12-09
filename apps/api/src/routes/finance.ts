import { Router, Request, Response, NextFunction } from 'express';
import { AccountType } from '@sync-erp/database';
import { AccountService } from '../services/AccountService';
import { JournalService } from '../services/JournalService';
import { ReportService } from '../services/ReportService';
import { z } from 'zod';

export const financeRouter = Router();
const accountService = new AccountService();
const journalService = new JournalService();
const reportService = new ReportService();

const CreateAccountSchema = z.object({
  code: z.string().min(3).max(10),
  name: z.string().min(1),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
});

const CreateJournalSchema = z.object({
  reference: z.string().optional(),
  date: z
    .string()
    .datetime()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  memo: z.string().optional(),
  lines: z
    .array(
      z.object({
        accountCode: z.string(),
        debit: z.number().min(0).optional(),
        credit: z.number().min(0).optional(),
      })
    )
    .min(2),
});

// ========== ACCOUNTS ==========

// GET /api/finance/accounts - List accounts
financeRouter.get('/accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const type = req.query.type as string | undefined;
    const accounts = await accountService.list(companyId, type as AccountType | undefined);
    res.json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
});

// POST /api/finance/accounts - Create account
financeRouter.post('/accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const validated = CreateAccountSchema.parse(req.body);
    const account = await accountService.create(companyId, {
      ...validated,
      type: validated.type as AccountType,
    });
    res.status(201).json({ success: true, data: account });
  } catch (error) {
    next(error);
  }
});

// POST /api/finance/accounts/seed - Seed default chart of accounts
financeRouter.post('/accounts/seed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const accounts = await accountService.seedDefaultAccounts(companyId);
    res.json({ success: true, data: accounts, message: `${accounts.length} accounts created` });
  } catch (error) {
    next(error);
  }
});

// ========== JOURNALS ==========

// GET /api/finance/journals - List journal entries
financeRouter.get('/journals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const journals = await journalService.list(companyId, startDate, endDate);
    res.json({ success: true, data: journals });
  } catch (error) {
    next(error);
  }
});

// GET /api/finance/journals/:id - Get journal entry
financeRouter.get('/journals/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const journal = await journalService.getById(req.params.id, companyId);
    if (!journal) {
      return res.status(404).json({ success: false, error: { message: 'Journal not found' } });
    }
    res.json({ success: true, data: journal });
  } catch (error) {
    next(error);
  }
});

// POST /api/finance/journals - Create journal entry
financeRouter.post('/journals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const validated = CreateJournalSchema.parse(req.body);
    const journal = await journalService.create(companyId, validated);
    res.status(201).json({ success: true, data: journal });
  } catch (error) {
    next(error);
  }
});

// ========== REPORTS ==========

// GET /api/finance/reports/trial-balance - Trial Balance
financeRouter.get(
  '/reports/trial-balance',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : undefined;
      const report = await reportService.getTrialBalance(companyId, asOfDate);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/finance/reports/general-ledger/:accountId - General Ledger
financeRouter.get(
  '/reports/general-ledger/:accountId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const report = await reportService.getGeneralLedger(
        companyId,
        req.params.accountId,
        startDate,
        endDate
      );
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/finance/reports/income-statement - Income Statement
financeRouter.get(
  '/reports/income-statement',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const startDate = new Date(
        (req.query.startDate as string) || new Date().getFullYear() + '-01-01'
      );
      const endDate = new Date((req.query.endDate as string) || new Date().toISOString());
      const report = await reportService.getIncomeStatement(companyId, startDate, endDate);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);
