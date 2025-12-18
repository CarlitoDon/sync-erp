import { Router } from 'express';
import { AdminController } from '../modules/admin/controller';

const router = Router();
const controller = new AdminController();

// All admin routes require auth + company context (handled by global /api middleware)
// TODO: Add ADMIN role check with requirePermission('admin:*')

// GET /api/admin/saga-logs - List saga failures
router.get('/saga-logs', controller.getSagaLogs);

// GET /api/admin/journals/orphans - List orphan journal entries
router.get('/journals/orphans', controller.getOrphanJournals);

export { router as adminRouter };
