import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from '../services/invoice.service';
import { CreateInvoiceFromSOSchema } from '@sync-erp/shared';

export class InvoiceController {
  private service = new InvoiceService();

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const status = req.query.status as string | undefined;
      const invoices = await this.service.list(companyId, status);
      res.json({ success: true, data: invoices });
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
      // Use CreateInvoiceFromSOSchema - only requires orderId
      const validated = CreateInvoiceFromSOSchema.parse(req.body);
      const invoice = await this.service.createFromSalesOrder(
        companyId,
        {
          orderId: validated.orderId,
          dueDate: validated.dueDate,
          taxRate: validated.taxRate,
          invoiceNumber: validated.invoiceNumber,
          businessDate: validated.businessDate || new Date(), // G5: Default to today
        }
      );
      res.status(201).json({ success: true, data: invoice });
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
      const invoice = await this.service.getById(
        req.params.id,
        companyId
      );
      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: { message: 'Invoice not found' },
        });
      }
      res.json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  };

  post = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const company = req.company!;
      const idempotencyKey = req.headers['x-idempotency-key'] as
        | string
        | undefined;
      // FR-010.1: Extract correlationId and actorId for audit trail
      const correlationId = req.correlationId;
      const actorId = req.context.userId;

      const invoice = await this.service.post(
        req.params.id,
        companyId,
        company.businessShape,
        company.configs,
        idempotencyKey,
        undefined, // businessDate - could be from body
        actorId,
        correlationId
      );
      res.json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  };

  void = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const invoice = await this.service.void(
        req.params.id,
        companyId
      );
      res.json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  };

  getOutstanding = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const invoices = await this.service.getOutstanding(companyId);
      res.json({ success: true, data: invoices });
    } catch (error) {
      next(error);
    }
  };

  getByOrderId = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const invoice = await this.service.getByOrderId(
        req.params.orderId,
        companyId
      );
      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: { message: 'Invoice not found' },
        });
      }
      res.json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  };

  getRemainingAmount = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const remaining = await this.service.getRemainingAmount(
        req.params.id,
        companyId
      );
      res.json({ success: true, data: { remaining } });
    } catch (error) {
      next(error);
    }
  };
}
