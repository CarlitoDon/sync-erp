import { z } from 'zod';

// ============================================
// Core Finance Types
// ============================================

import {
  InvoiceTypeType as InvoiceType,
  InvoiceStatusType as InvoiceStatus,
  JournalEntry,
  JournalLine,
} from '../generated/zod/index.js';

export type { InvoiceType, InvoiceStatus };

export const TAX_RATES = [
  { label: 'No Tax (0%)', value: 0 },
  { label: 'PPN 11%', value: 11 },
  { label: 'PPN 12%', value: 12 },
] as const;

// Chart of Accounts
export const AccountType = z.enum([
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
]);
export type AccountType = z.infer<typeof AccountType>;

export interface FinanceAccount {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: AccountType;
  isActive: boolean;
}

export type { JournalEntry, JournalLine };

// ============================================
// DTOs (Data Transfer Objects)
// ============================================

export interface CreateInvoiceDto {
  orderId?: string;
  partnerId: string;
  type: InvoiceType;
  dueDate: Date | string; // Allow string from JSON
  amount: number;
  taxRate?: number;
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
