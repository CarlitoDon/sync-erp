import { Request, Response, NextFunction } from 'express';
import { PurchaseOrderService } from './purchase-order.service';
import { CreatePurchaseOrderSchema } from '@sync-erp/shared';

export class PurchaseOrderController {
  private service = new PurchaseOrderService();

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const status = req.query.status as string | undefined;

      const orders = await this.service.list(companyId, status);
      res.json({ success: true, data: orders });
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
      const order = await this.service.getById(
        req.params.id,
        companyId
      );

      if (!order) {
        return res.status(404).json({
          success: false,
          error: { message: 'Purchase order not found' },
        });
      }

      res.json({ success: true, data: order });
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
      const userId = req.context.userId!;

      // We assume Schema matches API input. Using 'PURCHASE' type injection if needed,
      // but PO logic is simpler. Schema in Step 1009 CreatePurchaseOrderSchema has type literal 'PURCHASE'.
      // If FE doesn't send it, we inject it.
      const body = { ...req.body, type: 'PURCHASE' };
      const validated = CreatePurchaseOrderSchema.parse(body);

      const order = await this.service.create(
        companyId,
        validated,
        undefined,
        userId
      );
      res.status(201).json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  };

  confirm = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const userId = req.context.userId!;

      const order = await this.service.confirm(
        req.params.id,
        companyId,
        userId
      );
      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  };

  cancel = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const userId = req.context.userId!;

      const order = await this.service.cancel(
        req.params.id,
        companyId,
        userId
      );
      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  };
}
