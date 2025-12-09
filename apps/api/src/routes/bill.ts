import { Router, Request, Response, NextFunction } from 'express';
import { BillService } from '../services/BillService';
import { z } from 'zod';

export const billRouter = Router();
const billService = new BillService();

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
billRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const status = req.query.status as string | undefined;

    const bills = await billService.list(companyId, status);
    res.json({ success: true, data: bills });
  } catch (error) {
    next(error);
  }
});

// GET /api/bills/outstanding - Get outstanding bills
billRouter.get('/outstanding', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const bills = await billService.getOutstanding(companyId);
    res.json({ success: true, data: bills });
  } catch (error) {
    next(error);
  }
});

// GET /api/bills/:id - Get bill by ID
billRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const bill = await billService.getById(req.params.id, companyId);

    if (!bill) {
      return res.status(404).json({ success: false, error: { message: 'Bill not found' } });
    }

    res.json({ success: true, data: bill });
  } catch (error) {
    next(error);
  }
});

// POST /api/bills - Create bill from PO
billRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const userId = req.context.userId!;
    const validated = CreateBillSchema.parse(req.body);

    const bill = await billService.createFromPurchaseOrder(companyId, userId, validated);
    res.status(201).json({ success: true, data: bill });
  } catch (error) {
    next(error);
  }
});

// POST /api/bills/:id/post - Post/approve bill
billRouter.post('/:id/post', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const bill = await billService.post(req.params.id, companyId);
    res.json({ success: true, data: bill });
  } catch (error) {
    next(error);
  }
});

// POST /api/bills/:id/void - Void bill
billRouter.post('/:id/void', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const bill = await billService.void(req.params.id, companyId);
    res.json({ success: true, data: bill });
  } catch (error) {
    next(error);
  }
});

// GET /api/bills/:id/remaining - Get remaining amount
billRouter.get('/:id/remaining', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const remaining = await billService.getRemainingAmount(req.params.id);
    res.json({ success: true, data: { remaining } });
  } catch (error) {
    next(error);
  }
});
