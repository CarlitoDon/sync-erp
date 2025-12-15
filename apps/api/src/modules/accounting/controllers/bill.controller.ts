import { Request, Response, NextFunction } from 'express';
import { BillService } from '../services/bill.service';
import {
  CreateBillFromPOSchema,
  CreateManualBillSchema,
} from '@sync-erp/shared';

export class BillController {
  private service = new BillService();

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const status = req.query.status as string | undefined;
      const bills = await this.service.list(companyId, status);
      res.json({ success: true, data: bills });
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

      // Check if this is manual creation (has partnerId + subtotal, no orderId)
      if (
        !req.body.orderId &&
        req.body.partnerId &&
        req.body.subtotal !== undefined
      ) {
        const validated = CreateManualBillSchema.parse(req.body);
        const bill = await this.service.createManual(companyId, validated);
        return res.status(201).json({ success: true, data: bill });
      }

      // Otherwise, use PO-based creation (only requires orderId)
      const validated = CreateBillFromPOSchema.parse(req.body);
      const bill = await this.service.createFromPurchaseOrder(companyId, {
        orderId: validated.orderId,
        dueDate: validated.dueDate,
        taxRate: validated.taxRate,
        invoiceNumber: validated.invoiceNumber,
      });
      res.status(201).json({ success: true, data: bill });
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
      const bill = await this.service.getById(
        req.params.id,
        companyId
      );
      if (!bill) {
        return res.status(404).json({
          success: false,
          error: { message: 'Bill not found' },
        });
      }
      res.json({ success: true, data: bill });
    } catch (error) {
      next(error);
    }
  };

  post = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const bill = await this.service.post(req.params.id, companyId);
      res.json({ success: true, data: bill });
    } catch (error) {
      next(error);
    }
  };

  void = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const bill = await this.service.void(req.params.id, companyId);
      res.json({ success: true, data: bill });
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
      const bills = await this.service.getOutstanding(companyId);
      res.json({ success: true, data: bills });
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

  getByOrderId = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const bill = await this.service.getByOrderId(
        req.params.orderId,
        companyId
      );
      if (!bill) {
        return res.status(404).json({
          success: false,
          error: { message: 'No bill found for this order' },
        });
      }
      res.json({ success: true, data: bill });
    } catch (error) {
      next(error);
    }
  };
}
