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
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/Card';
import {
  InvoiceTypeSchema,
  JournalSourceTypeSchema,
} from '@sync-erp/shared';
import {
  ArchiveBoxIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  CubeIcon,
  DocumentTextIcon,
  TagIcon,
} from '@heroicons/react/24/outline';

type DashboardMetrics = RouterOutputs['dashboard']['getMetrics'];
type RecentTransaction =
  DashboardMetrics['recentTransactions'][number];
type IconType = ComponentType<SVGProps<SVGSVGElement>>;

const dashboardDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
});

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
          <div className="min-h-48 animate-pulse rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm">
            <div className="mb-4 h-3 w-32 rounded bg-slate-200" />
            <div className="h-9 w-64 rounded bg-slate-200" />
            <div className="mt-4 h-4 w-80 max-w-full rounded bg-slate-100" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent>
                  <div className="mb-2 h-4 w-20 rounded bg-slate-200" />
                  <div className="h-8 w-16 rounded bg-slate-200" />
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
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
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
          <div className="space-y-8">
            <DashboardKPIs />

            <section aria-labelledby="operational-pulse-heading">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700">
                  Work queue
                </p>
                <h2
                  id="operational-pulse-heading"
                  className="mt-1 text-xl font-semibold tracking-tight text-slate-950"
                >
                  Operational pulse
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Open documents and master data at a glance.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <QuickStatCard
                  title="Unpaid Invoices"
                  value={String(metrics?.unpaidInvoices || 0)}
                  description="Customer invoices still open"
                  icon={DocumentTextIcon}
                  tone="border-amber-100 bg-amber-50 text-amber-700"
                />
                <QuickStatCard
                  title="Unpaid Bills"
                  value={String(metrics?.unpaidBills || 0)}
                  description="Vendor bills still open"
                  icon={ArchiveBoxIcon}
                  tone="border-rose-100 bg-rose-50 text-rose-700"
                />
                <QuickStatCard
                  title="Pending Orders"
                  value={String(metrics?.pendingOrders || 0)}
                  description="Orders waiting for progress"
                  icon={CubeIcon}
                  tone="border-sky-100 bg-sky-50 text-sky-700"
                />
                <QuickStatCard
                  title="Products"
                  value={String(metrics?.productsCount || 0)}
                  description="Products in your catalog"
                  icon={TagIcon}
                  tone="border-emerald-100 bg-emerald-50 text-emerald-700"
                />
              </div>
            </section>

            {/* Info Cards */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <OnboardingGuide metrics={metrics ?? null} />

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>
                    Latest financial activity across this company.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentActivityList
                    transactions={metrics?.recentTransactions || []}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        );
    }
  };

  return (
    <PageContainer className="mx-auto w-full max-w-[1480px]">
      <PendingShapeBanner
        businessShape={currentCompany?.businessShape}
      />

      {/* Workspace Hero Header (Exact alignment with design-guidelines.html) */}
      <div className="mb-8 border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              Operations Workspace • {currentCompany?.businessShape === 'RENTAL' ? 'Rental & Sewa' : currentCompany?.businessShape || 'Standard'}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              {currentCompany?.name || 'Sync ERP'} Overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Ringkasan menyeluruh kesehatan finansial, pergerakan inventaris, dan operasional bisnis harian.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs">
              <CalendarDaysIcon className="h-4 w-4 text-slate-400" />
              <span>{dashboardDateFormatter.format(new Date())}</span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-2xs">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Workspace Aktif
            </span>
          </div>
        </div>
      </div>

      {renderDashboard()}
    </PageContainer>
  );
}

interface QuickStatCardProps {
  title: string;
  value: string;
  description: string;
  icon: IconType;
  tone: string;
}

function QuickStatCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: QuickStatCardProps) {
  return (
    <Card>
      <CardContent className="p-5 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {title}
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
              {value}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {description}
            </p>
          </div>
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tone}`}
          >
            <Icon className="h-5 w-5" />
          </span>
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
      <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200/70">
          <DocumentTextIcon className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-semibold text-slate-800">
          No recent activity
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          New transactions will appear here as they are recorded.
        </p>
      </div>
    );
  }

  const getTypeMeta = (type: string) => {
    switch (type) {
      case InvoiceTypeSchema.enum.INVOICE:
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
    }
  };

  return (
    <ul className="space-y-3">
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
                className={`flex h-9 w-9 items-center justify-center rounded-xl border ${typeMeta.className}`}
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
    </ul>
  );
}
