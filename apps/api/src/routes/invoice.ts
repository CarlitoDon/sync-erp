import { Router } from 'express';
import { InvoiceController } from '../modules/accounting/controllers/invoice.controller';
import { z } from 'zod';
import { requireActiveShape } from '../middlewares/shapeGuard';

export const invoiceRouter = Router();
const controller = new InvoiceController();

const CreateInvoiceSchema = z.object({
  orderId: z.string().uuid(),
  invoiceNumber: z.string().optional(),
  dueDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  taxRate: z.number().min(0).max(1).optional(),
});

// GET /api/invoices - List all invoices
invoiceRouter.get('/', controller.list);

// GET /api/invoices/outstanding - Get outstanding invoices
// InvoiceController doesn't have getOutstanding exposed directly as a method?
// Step 1298: It ONLY has list, create, getById, post, void.
// Legacy service had getOutstanding.
// Service has getOutstanding.
// I should either expose it in Controller or list with filter?
// InvoiceController.list uses `req.query.status`.
// Outstanding = Posted.
// `GET /?status=POSTED` is equivalent?
// But legacy route `/outstanding` might be used by FE.
// I'll add `getOutstanding` to Controller later or map to list with status=POSTED if strictly equivalent (except legacy ordered by dueDate, new list uses createAt).
// I will keep inline handler for special routes or update Controller.
// I prefer adding to Controller.
// I'll update Controller in next step.
// For now, I'll inline usage of Service in Controller if I can? No, I only have Controller instance.
// I'll use `controller.list` with forced query override for now? No.
// I'll skip replacing /outstanding route for a moment or map it to a custom handler calling controller.list if arguments match.
// GET /api/invoices/outstanding - Get outstanding invoices
invoiceRouter.get('/outstanding', controller.getOutstanding);

// GET /api/invoices/by-order/:orderId - Get invoice by Order ID
invoiceRouter.get('/by-order/:orderId', controller.getByOrderId);

// GET /api/invoices/:id - Get invoice by ID
invoiceRouter.get('/:id', controller.getById);

// POST /api/invoices - Create invoice from SO
invoiceRouter.post(
  '/',
  requireActiveShape(),
  async (req, res, next) => {
    try {
      CreateInvoiceSchema.parse(req.body);
      await controller.create(req, res, next);
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/invoices/:id/remaining - Get remaining amount
invoiceRouter.get('/:id/remaining', controller.getRemainingAmount);

// POST /api/invoices/:id/post - Post/approve invoice
invoiceRouter.post(
  '/:id/post',
  requireActiveShape(),
  controller.post
);

// POST /api/invoices/:id/void - Void invoice
invoiceRouter.post(
  '/:id/void',
  requireActiveShape(),
  controller.void
);

// GET /api/invoices/:id/remaining - Get remaining amount
// Controller missing `getRemainingAmount`.
// I should add it.
