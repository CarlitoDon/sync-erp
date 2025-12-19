import { router, protectedProcedure } from '../trpc';
import { DashboardService } from '../../modules/dashboard/service';

const dashboardService = new DashboardService();

export const dashboardRouter = router({
  /**
   * Get dashboard KPIs
   */
  getKPIs: protectedProcedure.query(async ({ ctx }) => {
    return dashboardService.getKPIs(ctx.companyId!);
  }),
});

export type DashboardRouter = typeof dashboardRouter;
