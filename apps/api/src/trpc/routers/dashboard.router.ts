import { router, protectedProcedure } from '../trpc';
import { container, ServiceKeys } from '../../modules/common/di';
import { DashboardService } from '../../modules/dashboard/service';

const dashboardService = container.resolve<DashboardService>(
  ServiceKeys.DASHBOARD_SERVICE
);

export const dashboardRouter = router({
  /**
   * Get dashboard KPIs
   */
  getKPIs: protectedProcedure.query(async ({ ctx }) => {
    return dashboardService.getKPIs(ctx.companyId!);
  }),

  /**
   * Get dashboard metrics (detailed)
   */
  getMetrics: protectedProcedure.query(async ({ ctx }) => {
    return dashboardService.getMetrics(ctx.companyId!);
  }),
});

export type DashboardRouter = typeof dashboardRouter;
