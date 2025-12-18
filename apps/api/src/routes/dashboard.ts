import { Router } from 'express';
import { DashboardController } from '../modules/dashboard/controller';

const router = Router();
const controller = new DashboardController();

// GET /api/dashboard/kpis - Get dashboard KPIs
// Auth middleware already applied globally via /api prefix in index.ts
router.get('/kpis', controller.getKPIs);

export { router as dashboardRouter };
