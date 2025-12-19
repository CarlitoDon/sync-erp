import { useCompany } from '@/contexts/CompanyContext';
import { useCompanyData } from '@/hooks/useCompanyData';
import { dashboardService } from '@/features/dashboard/services/dashboardService';
import { formatCurrency, formatDate } from '@/utils/format';
import OnboardingGuide from '@/features/dashboard/components/OnboardingGuide';
import PendingShapeBanner from '@/features/dashboard/components/PendingShapeBanner';
import { DashboardKPIs } from '@/features/dashboard/components/DashboardKPIs';
import type { DashboardMetrics, RecentTransaction } from '@/features/dashboard/types';

export default function Dashboard() {
  const { currentCompany } = useCompany();

  const {
    data: metrics,
    loading,
    error,
  } = useCompanyData<DashboardMetrics | null>(
    dashboardService.getMetrics,
    null
  );

  // Loading state
  if (loading) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-2xl p-8 text-white shadow-xl animate-pulse">
          <div className="h-8 bg-white/20 rounded w-64 mb-2" />
          <div className="h-5 bg-white/10 rounded w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse"
            >
              <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600">
            Failed to load dashboard data
          </p>
          <p className="text-red-400 text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* PENDING Shape Banner - shows when setup incomplete */}
      <PendingShapeBanner
        businessShape={currentCompany?.businessShape}
      />

      {/* Phase 1: Backend-sourced KPIs (FR-001, FR-002) */}
      <DashboardKPIs />

      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-2xl p-8 text-white shadow-xl">
        <h1 className="text-3xl font-bold mb-2">
          Welcome to Sync ERP
        </h1>
        <p className="text-primary-100 text-lg">
          {currentCompany
            ? `Managing ${currentCompany.name}`
            : 'Select a company to get started'}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Accounts Receivable"
          value={formatCurrency(metrics?.totalReceivables || 0)}
          icon="�"
          color="from-blue-400 to-blue-600"
        />
        <StatCard
          title="Accounts Payable"
          value={formatCurrency(metrics?.totalPayables || 0)}
          icon="�"
          color="from-rose-400 to-rose-600"
        />
        <StatCard
          title="Unpaid Invoices"
          value={String(metrics?.unpaidInvoices || 0)}
          icon="📄"
          color="from-yellow-400 to-orange-500"
        />
        <StatCard
          title="Unpaid Bills"
          value={String(metrics?.unpaidBills || 0)}
          icon="🧾"
          color="from-green-400 to-green-600"
        />
        <StatCard
          title="Pending Orders"
          value={String(metrics?.pendingOrders || 0)}
          icon="📦"
          color="from-purple-400 to-purple-600"
        />
        <StatCard
          title="Products"
          value={String(metrics?.productsCount || 0)}
          icon="🏷️"
          color="from-teal-400 to-teal-600"
        />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OnboardingGuide metrics={metrics} />

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 card-hover">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Recent Activity
          </h2>
          <RecentActivityList
            transactions={metrics?.recentTransactions || []}
          />
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 card-hover">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">
            {value}
          </p>
        </div>
        <div
          className={`w-12 h-12 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center text-2xl`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

interface RecentActivityListProps {
  transactions: RecentTransaction[];
}

function RecentActivityList({
  transactions,
}: RecentActivityListProps) {
  if (transactions.length === 0) {
    return (
      <p className="text-gray-500 text-center py-8">
        No recent activity
      </p>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'INVOICE':
        return '📄';
      case 'BILL':
        return '🧾';
      case 'PAYMENT':
        return '💵';
      default:
        return '📝';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'INVOICE':
        return 'text-blue-600 bg-blue-50';
      case 'BILL':
        return 'text-red-600 bg-red-50';
      case 'PAYMENT':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <ul className="space-y-3">
      {transactions.map((tx) => (
        <li
          key={tx.id}
          className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
        >
          <div className="flex items-center space-x-3">
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${getTypeColor(tx.type)}`}
            >
              {getIcon(tx.type)}
            </span>
            <div>
              <p className="text-sm font-medium text-gray-800">
                {tx.description}
              </p>
              <p className="text-xs text-gray-400">
                {formatDate(new Date(tx.date))}
              </p>
            </div>
          </div>
          <p
            className={`text-sm font-semibold ${tx.type === 'BILL' ? 'text-red-600' : 'text-gray-800'}`}
          >
            {tx.type === 'BILL' ? '-' : '+'}
            {formatCurrency(tx.amount)}
          </p>
        </li>
      ))}
    </ul>
  );
}
