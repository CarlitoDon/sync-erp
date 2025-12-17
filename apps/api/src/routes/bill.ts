import { Router } from 'express';
import { BillController } from '../modules/accounting/controllers/bill.controller';
import { requireActiveShape } from '../middlewares/shapeGuard';

export const billRouter = Router();
const controller = new BillController();

// GET /api/bills - List all bills
billRouter.get('/', controller.list);

// GET /api/bills/outstanding - Get outstanding bills
// Missing in Controller (same as Invoice).
// I will implement in Controller soon.
billRouter.get('/outstanding', controller.getOutstanding);

// GET /api/bills/by-order/:orderId - Get bill by order ID (for duplicate check)
billRouter.get('/by-order/:orderId', controller.getByOrderId);

// GET /api/bills/:id - Get bill by ID
billRouter.get('/:id', controller.getById);

// POST /api/bills - Create bill (from PO or manual entry)
// Controller handles validation - detects mode by checking payload
billRouter.post('/', requireActiveShape(), controller.create);

// POST /api/bills/:id/post - Post/approve bill
billRouter.post('/:id/post', requireActiveShape(), controller.post);

// POST /api/bills/:id/void - Void bill
billRouter.post('/:id/void', requireActiveShape(), controller.void);

// GET /api/bills/:id/remaining - Get remaining amount
billRouter.get('/:id/remaining', controller.getRemainingAmount);
