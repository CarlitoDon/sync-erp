import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';

export function useDashboard() {
  const { currentCompany } = useCompany();

  // Get dashboard KPIs using tRPC
  const {
    data: kpis,
    isLoading: loading,
    refetch: loadData,
  } = trpc.dashboard.getKPIs.useQuery(undefined, {
    enabled: !!currentCompany?.id,
  });

  return {
    kpis,
    loading,
    loadData,
  };
}

export default useDashboard;
