import { useCompany } from '@/contexts/CompanyContext';
import { trpc, RouterOutputs } from '@/lib/trpc';
import { StatCard } from '@/features/dashboard/components/StatCard';
import {
  ArrowDownLeftIcon,
  ArrowTrendingUpIcon,
  ArrowUpRightIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';

type DashboardKPIsType = RouterOutputs['dashboard']['getKPIs'];

const defaultKPIs: DashboardKPIsType = {
  totalSales: 0,
  outstandingAR: 0,
  outstandingAP: 0,
  inventoryValue: 0,
  currency: 'IDR',
};

/**
 * DashboardKPIs component - displays read-only KPI cards.
 * Part of Phase 1 Dashboard KPIs (US1).
 *
 * Per FR-001: Total Sales, Outstanding AR, Outstanding AP, Inventory Value
 * Per FR-002: Data refreshed on page load (no auto-refresh)
 */
export function DashboardKPIs() {
  const { currentCompany } = useCompany();

  const { data: kpis = defaultKPIs, isLoading: loading } =
    trpc.dashboard.getKPIs.useQuery(undefined, {
      enabled: !!currentCompany?.id,
    });

  return (
    <section aria-labelledby="business-overview-heading">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700">
            Financial health
          </p>
          <h2
            id="business-overview-heading"
            className="mt-1 text-xl font-semibold tracking-tight text-slate-950"
          >
            Business overview
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            A current snapshot of your key business values.
          </p>
        </div>
        <span className="w-fit rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
          {kpis.currency}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Sales"
          value={Number(kpis.totalSales)}
          currency={kpis.currency}
          isLoading={loading}
          icon={ArrowTrendingUpIcon}
          tone="indigo"
          description="Sales recorded to date"
        />
        <StatCard
          title="Outstanding Receivables"
          value={Number(kpis.outstandingAR)}
          currency={kpis.currency}
          isLoading={loading}
          icon={ArrowDownLeftIcon}
          tone="sky"
          description="Still awaiting collection"
        />
        <StatCard
          title="Outstanding Payables"
          value={Number(kpis.outstandingAP)}
          currency={kpis.currency}
          isLoading={loading}
          icon={ArrowUpRightIcon}
          tone="amber"
          description="Still awaiting payment"
        />
        <StatCard
          title="Inventory Value"
          value={Number(kpis.inventoryValue)}
          currency={kpis.currency}
          isLoading={loading}
          icon={CubeIcon}
          tone="emerald"
          description="Current stock valuation"
        />
      </div>
    </section>
  );
}
