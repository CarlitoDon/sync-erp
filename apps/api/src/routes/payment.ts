import { Router, Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/PaymentService';
import { z } from 'zod';

export const paymentRouter = Router();
const paymentService = new PaymentService();

const CreatePaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'OTHER']),
});

// GET /api/payments - List all payments
paymentRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const invoiceId = req.query.invoiceId as string | undefined;

    const payments = await paymentService.list(companyId, invoiceId);
    res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/:id - Get payment by ID
paymentRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const payment = await paymentService.getById(req.params.id, companyId);

    if (!payment) {
      return res.status(404).json({ success: false, error: { message: 'Payment not found' } });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments - Record a payment
paymentRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const validated = CreatePaymentSchema.parse(req.body);

    const payment = await paymentService.create(companyId, validated);
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/invoice/:invoiceId - Get payments for an invoice
paymentRouter.get(
  '/invoice/:invoiceId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payments = await paymentService.getPaymentHistory(req.params.invoiceId);
      res.json({ success: true, data: payments });
    } catch (error) {
      next(error);
    }
  }
);
