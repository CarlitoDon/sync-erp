import { useCompany } from '@/contexts/CompanyContext';
import { trpc, RouterOutputs } from '@/lib/trpc';
import { StatCard } from '@/features/dashboard/components/StatCard';

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
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Business Overview
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Sales"
          value={Number(kpis.totalSales)}
          currency={kpis.currency}
          isLoading={loading}
        />
        <StatCard
          title="Outstanding Receivables"
          value={Number(kpis.outstandingAR)}
          currency={kpis.currency}
          isLoading={loading}
        />
        <StatCard
          title="Outstanding Payables"
          value={Number(kpis.outstandingAP)}
          currency={kpis.currency}
          isLoading={loading}
        />
        <StatCard
          title="Inventory Value"
          value={Number(kpis.inventoryValue)}
          currency={kpis.currency}
          isLoading={loading}
        />
      </div>
    </div>
  );
}
