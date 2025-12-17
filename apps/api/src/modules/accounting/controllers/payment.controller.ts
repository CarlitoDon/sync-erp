import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service';
import { CreatePaymentInput } from '@sync-erp/shared';

export class PaymentController {
  private service = new PaymentService();

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const invoiceId = req.query.invoiceId as string | undefined;
      const payments = await this.service.list(companyId, invoiceId);
      res.json({ success: true, data: payments });
    } catch (error) {
      next(error);
    }
  };

  create = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const idempotencyKey = req.headers['x-idempotency-key'] as
        | string
        | undefined;

      // Validate generic input for now, assume FE sends CreatePaymentInput shape
      const validated = req.body as CreatePaymentInput;
      // Inject default businessDate if missing (G5)
      // Controller responsibility: Ensure payload is complete for domain
      const payload: CreatePaymentInput = {
        ...validated,
        businessDate: validated.businessDate || new Date(),
      };
      const payment = await this.service.create(
        companyId,
        payload,
        idempotencyKey
      );
      res.status(201).json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  };

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const payment = await this.service.getById(
        req.params.id,
        companyId
      );
      if (!payment) {
        return res.status(404).json({
          success: false,
          error: { message: 'Payment not found' },
        });
      }
      res.json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  };

  getPaymentHistory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      // Route param :invoiceId
      const invoiceId = req.params.invoiceId;
      const payments = await this.service.list(companyId, invoiceId);
      res.json({ success: true, data: payments });
    } catch (error) {
      next(error);
    }
  };
}
