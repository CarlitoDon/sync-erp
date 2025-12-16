import api from '../../../services/api';
import { ensureArray } from '../../../utils/safeData';
import type { DashboardMetrics, RecentTransaction } from '../types';

interface InvoiceResponse {
  id: string;
  balance: string | number;
  status: string;
  invoiceNumber: string;
  amount: string | number;
  createdAt: string;
  type?: string;
}

interface OrderResponse {
  id: string;
  status: string;
}

interface ProductResponse {
  id: string;
}

export const dashboardService = {
  async getMetrics(): Promise<DashboardMetrics> {
    // Parallel fetch from existing endpoints
    const [invoicesRes, billsRes, ordersRes, productsRes] =
      await Promise.all([
        api.get('/invoices?status=POSTED'),
        api.get('/bills?status=POSTED'),
        api.get('/sales-orders'),
        api.get('/products'),
      ]);

    const invoices: InvoiceResponse[] = ensureArray(
      invoicesRes.data?.data
    );
    const bills: InvoiceResponse[] = ensureArray(billsRes.data?.data);
    const orders: OrderResponse[] = ensureArray(ordersRes.data?.data);
    const products: ProductResponse[] = ensureArray(
      productsRes.data?.data
    );

    // Calculate aggregates
    const totalReceivables = invoices.reduce(
      (sum, inv) => sum + Number(inv.balance || 0),
      0
    );

    const totalPayables = bills.reduce(
      (sum, bill) => sum + Number(bill.balance || 0),
      0
    );

    const pendingOrders = orders.filter(
      (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
    ).length;

    return {
      totalReceivables,
      totalPayables,
      productsCount: products.length,
      pendingOrders,
      totalOrders: orders.length,
      unpaidInvoices: invoices.length,
      unpaidBills: bills.length,
      recentTransactions: await getRecentTransactions(),
    };
  },
};

async function getRecentTransactions(): Promise<RecentTransaction[]> {
  // Fetch recent invoices and bills
  const [invoicesRes, billsRes] = await Promise.all([
    api.get('/invoices'),
    api.get('/bills'),
  ]);

  const invoices: InvoiceResponse[] = ensureArray(
    invoicesRes.data?.data
  );
  const bills: InvoiceResponse[] = ensureArray(billsRes.data?.data);

  // Combine and sort by date
  const transactions: RecentTransaction[] = [
    ...invoices.slice(0, 5).map((inv) => ({
      id: inv.id,
      type: 'INVOICE' as const,
      description: inv.invoiceNumber || 'Invoice',
      amount: Number(inv.amount || 0),
      date: inv.createdAt,
    })),
    ...bills.slice(0, 5).map((bill) => ({
      id: bill.id,
      type: 'BILL' as const,
      description: bill.invoiceNumber || 'Bill',
      amount: Number(bill.amount || 0),
      date: bill.createdAt,
    })),
  ];

  // Sort by date descending and take top 5
  return transactions
    .sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    .slice(0, 5);
}
