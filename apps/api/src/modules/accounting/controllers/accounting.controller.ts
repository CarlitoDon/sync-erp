import { Request, Response, NextFunction } from 'express';
import { AccountService } from '../services/account.service';
import { JournalService } from '../services/journal.service';
import { ReportService } from '../services/report.service';

export class AccountingController {
  private accountService = new AccountService();
  private journalService = new JournalService();
  private reportService = new ReportService();

  // Accounts
  listAccounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const accounts = await this.accountService.list(companyId);
      res.json({ success: true, data: accounts });
    } catch (error) {
      next(error);
    }
  };

  createAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const account = await this.accountService.create(companyId, req.body);
      res.status(201).json({ success: true, data: account });
    } catch (error) {
      next(error);
    }
  };

  seedAccounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const accounts = await this.accountService.seedDefaultAccounts(companyId);
      res.json({ success: true, data: accounts });
    } catch (error) {
      next(error);
    }
  };

  // Journals
  listJournals = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const entries = await this.journalService.list(companyId, startDate, endDate);
      res.json({ success: true, data: entries });
    } catch (error) {
      next(error);
    }
  };

  createJournal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const entry = await this.journalService.create(companyId, req.body);
      res.status(201).json({ success: true, data: entry });
    } catch (error) {
      next(error);
    }
  };

  // Reports
  getTrialBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      const report = await this.reportService.getTrialBalance(companyId, date);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  };

  getGeneralLedger = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const accountId = req.params.accountId;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const report = await this.reportService.getGeneralLedger(
        companyId,
        accountId,
        startDate,
        endDate
      );
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  };

  getIncomeStatement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(new Date().getFullYear(), 0, 1);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

      const report = await this.reportService.getIncomeStatement(companyId, startDate, endDate);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  };
}
