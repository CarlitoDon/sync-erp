import api from '@/services/api';
import {
  Account,
  CreateJournalEntryInput,
  CreateJournalLineInput,
} from '@sync-erp/shared';
import { ensureArray } from '@/utils/safeData';

export type {
  Account,
  CreateJournalEntryInput,
  CreateJournalLineInput,
};

export interface JournalLine {
  id: string;
  accountId: string;
  account?: Account;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  reference: string | null;
  date: string;
  memo: string | null;
  lines: JournalLine[];
}

export interface TrialBalanceEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: Account['type'];
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalance {
  entries: TrialBalanceEntry[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export const financeService = {
  // Accounts
  async listAccounts(type?: Account['type']): Promise<Account[]> {
    const params = type ? { type } : {};
    const res = await api.get('/finance/accounts', { params });
    return ensureArray(res.data?.data);
  },

  async createAccount(data: {
    code: string;
    name: string;
    type: Account['type'];
  }): Promise<Account> {
    const res = await api.post('/finance/accounts', data);
    return res.data?.data ?? res.data;
  },

  async seedDefaultAccounts(): Promise<Account[]> {
    const res = await api.post('/finance/accounts/seed');
    return ensureArray(res.data?.data);
  },

  // Journals
  async listJournals(
    startDate?: string,
    endDate?: string
  ): Promise<JournalEntry[]> {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const res = await api.get('/finance/journals', { params });
    return ensureArray(res.data?.data);
  },

  async getJournal(id: string): Promise<JournalEntry> {
    const res = await api.get(`/finance/journals/${id}`);
    return res.data?.data ?? res.data;
  },

  async createJournal(
    data: CreateJournalEntryInput
  ): Promise<JournalEntry> {
    const res = await api.post('/finance/journals', data);
    return res.data?.data ?? res.data;
  },

  // Reports
  async getTrialBalance(asOfDate?: string): Promise<TrialBalance> {
    const params = asOfDate ? { asOfDate } : {};
    const res = await api.get('/finance/reports/trial-balance', {
      params,
    });
    return res.data?.data ?? res.data;
  },

  async getGeneralLedger(
    accountId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    account: Account;
    entries: {
      date: string;
      reference: string;
      memo: string;
      debit: number;
      credit: number;
      balance: number;
    }[];
    openingBalance: number;
    closingBalance: number;
  }> {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const res = await api.get(
      `/finance/reports/general-ledger/${accountId}`,
      { params }
    );
    return res.data?.data ?? res.data;
  },

  async getIncomeStatement(
    startDate?: string,
    endDate?: string
  ): Promise<{
    revenue: number;
    expenses: number;
    netIncome: number;
  }> {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const res = await api.get('/finance/reports/income-statement', {
      params,
    });
    return res.data?.data ?? res.data;
  },
};
