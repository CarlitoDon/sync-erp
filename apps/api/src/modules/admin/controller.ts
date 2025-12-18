import { Request, Response } from 'express';
import { AdminService } from './service';

/**
 * Admin Controller - HTTP boundary for admin observability endpoints.
 * Part of Phase 1 Admin Observability (US5).
 */
export class AdminController {
  private adminService: AdminService;

  constructor() {
    this.adminService = new AdminService();
  }

  /**
   * GET /api/admin/saga-logs
   * Returns list of failed/compensated sagas for admin review.
   */
  getSagaLogs = async (req: Request, res: Response) => {
    try {
      const companyId = req.headers['x-company-id'] as string;
      const step = req.query.step as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await this.adminService.getSagaLogs({
        companyId,
        step,
        limit,
        offset,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error('[ADMIN] Error fetching saga logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch saga logs',
      });
    }
  };

  /**
   * GET /api/admin/journals/orphans
   * Returns journal entries with missing/invalid source references.
   */
  getOrphanJournals = async (req: Request, res: Response) => {
    try {
      const companyId = req.headers['x-company-id'] as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await this.adminService.getOrphanJournals({
        companyId,
        limit,
        offset,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error('[ADMIN] Error fetching orphan journals:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch orphan journals',
      });
    }
  };
}
