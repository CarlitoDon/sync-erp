import type { ComponentType, SVGProps } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { trpc, RouterOutputs } from '@/lib/trpc';
import { formatCurrency, formatDate } from '@/utils/format';
import OnboardingGuide from '@/features/dashboard/components/OnboardingGuide';
import PendingShapeBanner from '@/features/dashboard/components/PendingShapeBanner';
import { RentalDashboard } from '@/features/dashboard/components/RentalDashboard';
import { DashboardKPIs } from '@/features/dashboard/components/DashboardKPIs';
import { PageContainer } from '@/components/layout/PageLayout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/Card';
import {
  InvoiceTypeSchema,
  JournalSourceTypeSchema,
} from '@sync-erp/shared';
<<<<<<< HEAD
import {
  ArchiveBoxIcon,
  BanknotesIcon,
  CreditCardIcon,
  CubeIcon,
  DocumentTextIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
=======
>>>>>>> origin/dev

type DashboardMetrics = RouterOutputs['dashboard']['getMetrics'];
type RecentTransaction =
  DashboardMetrics['recentTransactions'][number];
type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export default function Dashboard() {
  const { currentCompany } = useCompany();

  const {
    data: metrics,
    isLoading: loading,
    error,
  } = trpc.dashboard.getMetrics.useQuery(undefined, {
    enabled: !!currentCompany?.id,
  });

  // Loading state
  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-8">
<<<<<<< HEAD
          <div className="animate-pulse rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-2 h-8 w-64 rounded bg-slate-200" />
            <div className="h-5 w-48 rounded bg-slate-100" />
=======
          <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-2xl p-8 text-white shadow-xl animate-pulse">
            <div className="h-8 bg-white/20 rounded w-64 mb-2" />
            <div className="h-5 bg-white/10 rounded w-48" />
>>>>>>> origin/dev
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent>
<<<<<<< HEAD
                  <div className="mb-2 h-4 w-20 rounded bg-slate-200" />
                  <div className="h-8 w-16 rounded bg-slate-200" />
=======
                  <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
                  <div className="h-8 bg-gray-200 rounded w-16" />
>>>>>>> origin/dev
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  // Error state
  if (error) {
    return (
      <PageContainer>
        <div className="space-y-8">
<<<<<<< HEAD
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
=======
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
>>>>>>> origin/dev
            <p className="text-red-600">
              Failed to load dashboard data
            </p>
            <p className="text-red-400 text-sm mt-1">
              {error.message}
            </p>
          </div>
        </div>
      </PageContainer>
    );
  }

  const renderDashboard = () => {
    switch (currentCompany?.businessShape) {
      case 'RENTAL':
        return <RentalDashboard />;
      default:
        // Default (Retail/Manufacturing/Service/Pending)
        return (
          <>
            <DashboardKPIs />
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Accounts Receivable"
                value={formatCurrency(
                  Number(metrics?.totalReceivables || 0)
                )}
                icon={BanknotesIcon}
                tone="border-cyan-100 bg-cyan-50 text-cyan-700"
              />
              <StatCard
                title="Accounts Payable"
                value={formatCurrency(Number(metrics?.totalPayables || 0))}
                icon={CreditCardIcon}
                tone="border-rose-100 bg-rose-50 text-rose-700"
              />
              <StatCard
                title="Unpaid Invoices"
                value={String(metrics?.unpaidInvoices || 0)}
                icon={DocumentTextIcon}
                tone="border-amber-100 bg-amber-50 text-amber-700"
              />
              <StatCard
                title="Unpaid Bills"
                value={String(metrics?.unpaidBills || 0)}
                icon={ArchiveBoxIcon}
                tone="border-emerald-100 bg-emerald-50 text-emerald-700"
              />
              <StatCard
                title="Pending Orders"
                value={String(metrics?.pendingOrders || 0)}
                icon={CubeIcon}
                tone="border-sky-100 bg-sky-50 text-sky-700"
              />
              <StatCard
                title="Products"
                value={String(metrics?.productsCount || 0)}
                icon={TagIcon}
                tone="border-teal-100 bg-teal-50 text-teal-700"
              />
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <OnboardingGuide metrics={metrics ?? null} />

              <Card className="card-hover">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <RecentActivityList
                    transactions={metrics?.recentTransactions || []}
                  />
                </CardContent>
              </Card>
            </div>
          </>
        );
    }
  };

  return (
    <PageContainer>
<<<<<<< HEAD
=======
      {/* PENDING Shape Banner - shows when setup incomplete */}
>>>>>>> origin/dev
      <PendingShapeBanner
        businessShape={currentCompany?.businessShape}
      />

      {/* Hero Welcome Section */}
<<<<<<< HEAD
      <div className="mb-8 rounded-lg border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200/60">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Operations cockpit
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">
              Welcome to Sync ERP
            </h1>
            <p className="mt-2 text-lg text-slate-600">
              {currentCompany
                ? `Managing ${currentCompany.name}`
                : 'Select a company to get started'}
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live company workspace
          </div>
        </div>
      </div>

      {renderDashboard()}
=======
      <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-2xl p-8 text-white shadow-xl mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Welcome to Sync ERP
        </h1>
        <p className="text-primary-100 text-lg">
          {currentCompany
            ? `Managing ${currentCompany.name}`
            : 'Select a company to get started'}
        </p>
      </div>

      {/* Phase 1: Backend-sourced KPIs (FR-001, FR-002) */}
      <DashboardKPIs />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Accounts Receivable"
          value={formatCurrency(
            Number(metrics?.totalReceivables || 0)
          )}
          icon="💰"
          color="from-blue-400 to-blue-600"
        />
        <StatCard
          title="Accounts Payable"
          value={formatCurrency(Number(metrics?.totalPayables || 0))}
          icon="💳"
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
        <OnboardingGuide metrics={metrics ?? null} />

        <Card className="card-hover">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentActivityList
              transactions={metrics?.recentTransactions || []}
            />
          </CardContent>
        </Card>
      </div>
>>>>>>> origin/dev
    </PageContainer>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: IconType;
  tone: string;
}

function StatCard({ title, value, icon: Icon, tone }: StatCardProps) {
  return (
    <Card className="card-hover">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
<<<<<<< HEAD
            <p className="text-sm font-medium text-slate-500">
              {title}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              {value}
            </p>
          </div>
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-lg border ${tone}`}
          >
            <Icon className="h-6 w-6" />
          </span>
=======
            <p className="text-sm text-gray-500 font-medium">
              {title}
            </p>
            <p className="text-2xl font-bold text-gray-800 mt-1">
              {value}
            </p>
          </div>
          <div
            className={`w-12 h-12 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center text-2xl`}
          >
            {icon}
          </div>
>>>>>>> origin/dev
        </div>
      </CardContent>
    </Card>
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
      <p className="py-8 text-center text-slate-500">
        No recent activity
      </p>
    );
  }

  const getTypeMeta = (type: string) => {
    switch (type) {
      case InvoiceTypeSchema.enum.INVOICE:
<<<<<<< HEAD
        return {
          icon: DocumentTextIcon,
          className: 'border-cyan-100 bg-cyan-50 text-cyan-700',
        };
      case InvoiceTypeSchema.enum.BILL:
        return {
          icon: CreditCardIcon,
          className: 'border-red-100 bg-red-50 text-red-700',
        };
      case JournalSourceTypeSchema.enum.PAYMENT:
        return {
          icon: BanknotesIcon,
          className:
            'border-emerald-100 bg-emerald-50 text-emerald-700',
        };
      default:
        return {
          icon: DocumentTextIcon,
          className: 'border-slate-100 bg-slate-50 text-slate-700',
        };
=======
        return '📄';
      case InvoiceTypeSchema.enum.BILL:
        return '🧾';
      case JournalSourceTypeSchema.enum.PAYMENT:
        return '💵';
      default:
        return '📝';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case InvoiceTypeSchema.enum.INVOICE:
        return 'text-blue-600 bg-blue-50';
      case InvoiceTypeSchema.enum.BILL:
        return 'text-red-600 bg-red-50';
      case JournalSourceTypeSchema.enum.PAYMENT:
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
>>>>>>> origin/dev
    }
  };

  return (
    <ul className="space-y-3">
<<<<<<< HEAD
      {transactions.map((tx) => {
        const typeMeta = getTypeMeta(tx.type);
        const TypeIcon = typeMeta.icon;

        return (
          <li
            key={tx.id}
            className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0"
          >
            <div className="flex items-center space-x-3">
              <span
                className={`flex h-8 w-10 items-center justify-center rounded-md border ${typeMeta.className}`}
              >
                <TypeIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {tx.description}
                </p>
                <p className="text-xs text-slate-400">
                  {formatDate(new Date(tx.date))}
                </p>
              </div>
            </div>
            <p
              className={`text-sm font-semibold ${tx.type === InvoiceTypeSchema.enum.BILL ? 'text-red-600' : 'text-slate-800'}`}
            >
              {tx.type === InvoiceTypeSchema.enum.BILL ? '-' : '+'}
              {formatCurrency(Number(tx.amount))}
            </p>
          </li>
        );
      })}
=======
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
            className={`text-sm font-semibold ${tx.type === InvoiceTypeSchema.enum.BILL ? 'text-red-600' : 'text-gray-800'}`}
          >
            {tx.type === InvoiceTypeSchema.enum.BILL ? '-' : '+'}
            {formatCurrency(Number(tx.amount))}
          </p>
        </li>
      ))}
>>>>>>> origin/dev
    </ul>
  );
}
