import type { Invoice } from '@/types/api';

export interface DashboardMetrics {
  // US1: Business Overview
  totalReceivables: number;
  totalPayables: number;
  productsCount: number;

  // US2: Quick Stats
  pendingOrders: number;
  totalOrders: number;
  unpaidInvoices: number;
  unpaidBills: number;

  // US3: Recent Transactions
  recentTransactions: RecentTransaction[];
}

/* eslint-disable @sync-erp/no-hardcoded-enum */
export interface RecentTransaction {
  id: string;
  type: 'INVOICE' | 'BILL' | 'PAYMENT';
  description: string;
  amount: number;
  date: string;
}
/* eslint-enable @sync-erp/no-hardcoded-enum */

/* eslint-disable @sync-erp/no-hardcoded-enum */
export type InvoiceData = Pick<
  Invoice,
  | 'id'
  | 'balance'
  | 'status'
  | 'invoiceNumber'
  | 'amount'
  | 'createdAt'
>;
/* eslint-enable @sync-erp/no-hardcoded-enum */

// Onboarding types (Feature 017)
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetPath: string;
  isCompleted: boolean;
  icon: string;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  isAllComplete: boolean;
  percentComplete: number;
}
