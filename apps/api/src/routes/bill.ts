import { Router } from 'express';
import { BillController } from '../modules/accounting/controllers/bill.controller';
import { z } from 'zod';

export const billRouter = Router();
const controller = new BillController();

const CreateBillSchema = z.object({
  orderId: z.string().uuid(),
  invoiceNumber: z.string().optional(),
  dueDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  notes: z.string().optional(),
});

// GET /api/bills - List all bills
billRouter.get('/', controller.list);

// GET /api/bills/outstanding - Get outstanding bills
// Missing in Controller (same as Invoice).
// I will implement in Controller soon.
billRouter.get('/outstanding', controller.getOutstanding);

// GET /api/bills/:id - Get bill by ID
billRouter.get('/:id', controller.getById);

// POST /api/bills - Create bill from PO
billRouter.post('/', async (req, res, next) => {
  try {
    CreateBillSchema.parse(req.body);
    await controller.create(req, res, next);
  } catch (e) {
    next(e);
  }
});

// POST /api/bills/:id/post - Post/approve bill
billRouter.post('/:id/post', controller.post);

// POST /api/bills/:id/void - Void bill
billRouter.post('/:id/void', controller.void);

// GET /api/bills/:id/remaining - Get remaining amount
billRouter.get('/:id/remaining', controller.getRemainingAmount);
