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
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CreditCardIcon,
  CubeIcon,
  DocumentTextIcon,
  SignalIcon,
  TagIcon,
} from '@heroicons/react/24/outline';

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
          <div className="min-h-48 animate-pulse rounded-[1.75rem] bg-slate-900 p-8">
            <div className="mb-4 h-3 w-32 rounded bg-white/10" />
            <div className="h-9 w-64 rounded bg-white/15" />
            <div className="mt-4 h-4 w-80 max-w-full rounded bg-white/10" />
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

      {/* Workspace identity and status */}
      <section className="relative mb-8 overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-950 px-5 py-6 text-white shadow-[0_20px_55px_rgba(15,23,42,0.18)] sm:px-8 sm:py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(99,102,241,0.32),transparent_24rem),radial-gradient(circle_at_90%_20%,rgba(56,189,248,0.13),transparent_20rem)]" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full border border-white/[0.04]" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:items-center sm:gap-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.1] text-lg font-semibold text-white shadow-inner sm:h-14 sm:w-14">
              {currentCompany?.name?.charAt(0).toUpperCase() || (
                <BuildingOffice2Icon className="h-6 w-6" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">
                Operations workspace
              </p>
              <h1 className="mt-2 truncate text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
                {currentCompany?.name || 'Welcome to Sync ERP'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Your live overview of finance, inventory, and daily
                operations.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <div className="flex min-w-52 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3.5 backdrop-blur-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.08] text-primary-200">
                <CalendarDaysIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Today
                </p>
                <p className="mt-0.5 text-sm font-semibold text-white">
                  {new Intl.DateTimeFormat('en-US', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                  }).format(new Date())}
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2.5 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.08] px-4 py-3.5 text-sm font-medium text-emerald-100">
              <SignalIcon className="h-5 w-5 text-emerald-300" />
              <span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-300/70">
                  Status
                </span>
                <span className="mt-0.5 block font-semibold">
                  Workspace live
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

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
