import { Request, Response } from 'express';
import { DashboardService } from './service';

/**
 * Dashboard Controller - HTTP boundary for dashboard endpoints.
 * Part of Phase 1 Dashboard KPIs (US1).
 */
export class DashboardController {
  private dashboardService: DashboardService;

  constructor() {
    this.dashboardService = new DashboardService();
  }

  /**
   * GET /api/dashboard/kpis
   * Returns aggregated KPIs for the dashboard.
   * Per FR-001: Total Sales, Outstanding AR, Outstanding AP, Inventory Value
   */
  getKPIs = async (req: Request, res: Response) => {
    try {
      const companyId = req.headers['x-company-id'] as string;

      const kpis = await this.dashboardService.getKPIs(companyId);

      res.json({ success: true, data: kpis });
    } catch (error) {
      console.error('[DASHBOARD] Error fetching KPIs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard KPIs',
      });
    }
  };
}
