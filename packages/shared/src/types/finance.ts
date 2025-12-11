import { z } from 'zod';

// ============================================
// Core Finance Types
// ============================================

export type InvoiceType = 'INVOICE' | 'BILL';
export type InvoiceStatus = 'DRAFT' | 'POSTED' | 'PAID' | 'VOID';

export interface Invoice {
  id: string;
  companyId: string;
  orderId?: string;
  partnerId: string;
  type: InvoiceType;
  status: InvoiceStatus;
  dueDate: Date;
  amount: number;
  balance: number;
  invoiceNumber?: string | null;
}

export interface Payment {
  id: string;
  companyId: string;
  invoiceId: string;
  amount: number;
  date: Date;
  method: string;
}

// Chart of Accounts
export const AccountType = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);
export type AccountType = z.infer<typeof AccountType>;

export interface Account {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: AccountType;
  isActive: boolean;
}

export interface JournalEntry {
  id: string;
  companyId: string;
  reference?: string;
  date: Date;
  memo?: string | null;
}

export interface JournalLine {
  id: string;
  journalId: string;
  accountId: string;
  debit: number;
  credit: number;
}

// ============================================
// DTOs (Data Transfer Objects)
// ============================================

export interface CreateInvoiceDto {
  orderId?: string;
  partnerId: string;
  type: InvoiceType;
  dueDate: Date | string; // Allow string from JSON
  amount: number;
}

export interface CreatePaymentDto {
  invoiceId: string;
  amount: number;
  method: string;
  date?: Date | string;
}

export interface CreateJournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
}

export interface CreateJournalEntryInput {
  date: string; // ISO Date expected from frontend
  reference?: string;
  memo?: string;
  lines: CreateJournalLineInput[];
}

// ============================================
// Report Types
// ============================================

export interface AccountBalance {
  id: string;
  code: string;
  name: string;
  balance: number;
}

export interface AccountGroup {
  type: AccountType;
  accounts: AccountBalance[];
  total: number;
}

export interface BalanceSheetReport {
  assets: AccountGroup[];
  liabilities: AccountGroup[];
  equity: AccountGroup[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
}

export interface IncomeStatementReport {
  revenue: AccountGroup[];
  expenses: AccountGroup[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}
