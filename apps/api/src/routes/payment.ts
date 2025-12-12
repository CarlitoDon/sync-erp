import { Router } from 'express';
import { PaymentController } from '../modules/accounting/controllers/payment.controller';
import { z } from 'zod';

export const paymentRouter = Router();
const controller = new PaymentController();

const CreatePaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'OTHER']),
});

// GET /api/payments - List all payments
paymentRouter.get('/', controller.list);

// GET /api/payments/:id - Get payment by ID
paymentRouter.get('/:id', controller.getById);

// POST /api/payments - Record a payment
paymentRouter.post('/', async (req, res, next) => {
  try {
    CreatePaymentSchema.parse(req.body);
    await controller.create(req, res, next);
  } catch (e) {
    next(e);
  }
});

// GET /api/payments/invoice/:invoiceId - Get payments for an invoice
paymentRouter.get('/invoice/:invoiceId', controller.getPaymentHistory);

// GET /api/payments/invoice/:invoiceId - Get payments for an invoice
// Missing method in PaymentController: getPaymentHistory?
// Service has getPaymentHistory.
// I should expose it in Controller.
