import type { Invoice } from '@sync-erp/shared';

export interface DashboardMetrics {
  // US1: Business Overview
  totalReceivables: number;
  totalPayables: number;
  productsCount: number;

  // US2: Quick Stats
  pendingOrders: number;
  unpaidInvoices: number;
  unpaidBills: number;

  // US3: Recent Transactions
  recentTransactions: RecentTransaction[];
}

export interface RecentTransaction {
  id: string;
  type: 'INVOICE' | 'BILL' | 'PAYMENT';
  description: string;
  amount: number;
  date: string;
}

export type InvoiceData = Pick<
  Invoice,
  'id' | 'balance' | 'status' | 'invoiceNumber' | 'amount' | 'createdAt'
>;
