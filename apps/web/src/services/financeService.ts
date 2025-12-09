import api from './api';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  isActive: boolean;
}

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
    const res = await api.get('/api/finance/accounts', { params });
    return res.data.data;
  },

  async createAccount(data: {
    code: string;
    name: string;
    type: Account['type'];
  }): Promise<Account> {
    const res = await api.post('/api/finance/accounts', data);
    return res.data.data;
  },

  async seedDefaultAccounts(): Promise<Account[]> {
    const res = await api.post('/api/finance/accounts/seed');
    return res.data.data;
  },

  // Journals
  async listJournals(startDate?: string, endDate?: string): Promise<JournalEntry[]> {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const res = await api.get('/api/finance/journals', { params });
    return res.data.data;
  },

  async getJournal(id: string): Promise<JournalEntry> {
    const res = await api.get(`/api/finance/journals/${id}`);
    return res.data.data;
  },

  async createJournal(data: {
    reference?: string;
    date?: string;
    memo?: string;
    lines: { accountCode: string; debit?: number; credit?: number }[];
  }): Promise<JournalEntry> {
    const res = await api.post('/api/finance/journals', data);
    return res.data.data;
  },

  // Reports
  async getTrialBalance(asOfDate?: string): Promise<TrialBalance> {
    const params = asOfDate ? { asOfDate } : {};
    const res = await api.get('/api/finance/reports/trial-balance', { params });
    return res.data.data;
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
    const res = await api.get(`/api/finance/reports/general-ledger/${accountId}`, { params });
    return res.data.data;
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
    const res = await api.get('/api/finance/reports/income-statement', { params });
    return res.data.data;
  },
};
