import { Router, Request, Response, NextFunction } from 'express';
import { InvoiceService } from '../services/InvoiceService';
import { z } from 'zod';

export const invoiceRouter = Router();
const invoiceService = new InvoiceService();

const CreateInvoiceSchema = z.object({
  orderId: z.string().uuid(),
  invoiceNumber: z.string().optional(),
  dueDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  taxRate: z.number().min(0).max(1).optional(), // 0-1 range (e.g., 0.11 for 11%)
});

// GET /api/invoices - List all invoices
invoiceRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const status = req.query.status as string | undefined;

    const invoices = await invoiceService.list(companyId, status);
    res.json({ success: true, data: invoices });
  } catch (error) {
    next(error);
  }
});

// GET /api/invoices/outstanding - Get outstanding invoices
invoiceRouter.get('/outstanding', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const invoices = await invoiceService.getOutstanding(companyId);
    res.json({ success: true, data: invoices });
  } catch (error) {
    next(error);
  }
});

// GET /api/invoices/:id - Get invoice by ID
invoiceRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const invoice = await invoiceService.getById(req.params.id, companyId);

    if (!invoice) {
      return res.status(404).json({ success: false, error: { message: 'Invoice not found' } });
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
});

// POST /api/invoices - Create invoice from SO
invoiceRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const userId = req.context.userId!;
    const validated = CreateInvoiceSchema.parse(req.body);

    const invoice = await invoiceService.createFromSalesOrder(companyId, userId, validated);
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
});

// POST /api/invoices/:id/post - Post/approve invoice
invoiceRouter.post('/:id/post', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const invoice = await invoiceService.post(req.params.id, companyId);
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
});

// POST /api/invoices/:id/void - Void invoice
invoiceRouter.post('/:id/void', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const invoice = await invoiceService.void(req.params.id, companyId);
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
});

// GET /api/invoices/:id/remaining - Get remaining amount
invoiceRouter.get('/:id/remaining', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const remaining = await invoiceService.getRemainingAmount(req.params.id);
    res.json({ success: true, data: { remaining } });
  } catch (error) {
    next(error);
  }
});
