import { Request, Response, NextFunction } from 'express';
import { SalesService } from './sales.service';
import { CreateSalesOrderSchema } from '@sync-erp/shared';

export class SalesController {
  private service = new SalesService();

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
        return res
          .status(404)
          .json({
            success: false,
            error: { message: 'Sales order not found' },
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
      // userId is not used for creation logic currently, audit can be added later

      // We manually inject required literal if missing, or use schema that allows it?
      // Shared schema has type: 'SALES'. Frontend might send it, or might not.
      // If we assume frontend matches schema, we just parse.
      // If validation fails on missing type, we should inject it.
      const body = { ...req.body, type: 'SALES' };
      const validated = CreateSalesOrderSchema.parse(body);

      const order = await this.service.create(companyId, validated);
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
      const order = await this.service.confirm(
        req.params.id,
        companyId
      );
      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  };

  ship = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const reference = req.body.reference as string | undefined;

      const movements = await this.service.ship(
        companyId,
        req.params.id,
        reference
      );
      res.json({ success: true, data: movements });
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
      const order = await this.service.cancel(
        req.params.id,
        companyId
      );
      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  };
}
