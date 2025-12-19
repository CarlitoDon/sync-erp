import { z } from 'zod';
import type { Partner } from './partner.js';

// ============================================
// Core Finance Types
// ============================================

export type InvoiceType = 'INVOICE' | 'BILL';
export type InvoiceStatus = 'DRAFT' | 'POSTED' | 'PAID' | 'VOID';

export const TAX_RATES = [
  { label: 'No Tax (0%)', value: 0 },
  { label: 'PPN 11%', value: 11 },
  { label: 'PPN 12%', value: 12 },
] as const;

export interface Invoice {
  id: string;
  companyId: string;
  orderId?: string | null;
  partnerId: string;
  type: 'INVOICE' | 'BILL';
  status: 'DRAFT' | 'POSTED' | 'PAID' | 'VOID';
  invoiceNumber: string;
  dueDate: Date | string;
  amount: number;
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  balance: number;
  supplierInvoiceNumber?: string | null;
  paymentTermsString?: string | null; // Payment terms (NET30, NET60, etc.)
  notes?: string | null;
  version: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  partner?: Partner;
  payments?: Payment[];
  relatedInvoiceId?: string | null; // For credit notes
  creditNotes?: Invoice[]; // Reverse: invoices that reference this one as relatedInvoiceId
}

export interface Payment {
  id: string;
  companyId: string;
  invoiceId: string;
  amount: number;
  date: Date;
  method: string;
  createdAt: Date;
}

// Chart of Accounts
export const AccountType = z.enum([
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
]);
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
