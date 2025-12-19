export interface DashboardKPIs {
  totalSales: number;
  outstandingAR: number;
  outstandingAP: number;
  inventoryValue: number;
  currency: string;
}

export interface RecentTransaction {
  id: string;
  type: 'INVOICE' | 'BILL' | 'PAYMENT';
  description: string;
  amount: number;
  date: string | Date;
}

export interface DashboardMetrics {
  totalReceivables: number;
  totalPayables: number;
  productsCount: number;
  pendingOrders: number;
  totalOrders: number;
  unpaidInvoices: number;
  unpaidBills: number;
  recentTransactions: RecentTransaction[];
}
