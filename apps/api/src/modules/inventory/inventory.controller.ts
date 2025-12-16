import { Request, Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service';
import {
  GoodsReceiptSchema,
  StockAdjustmentSchema,
  DomainError,
} from '@sync-erp/shared';

/**
 * InventoryController
 *
 * A "dumb adapter" that only:
 * 1. Extracts data from req.body/query
 * 2. Validates with Zod schemas
 * 3. Calls the service layer
 * 4. Returns the response
 *
 * NO business logic. All logic lives in Service/Policy/Rules.
 */
export class InventoryController {
  private service = new InventoryService();

  // GET /api/inventory/stock - Get all stock levels
  getStockLevels = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const stockLevels =
        await this.service.getStockLevels(companyId);
      res.json({ success: true, data: stockLevels });
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };

  // GET /api/inventory/movements - Get inventory movements
  getMovements = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const productId = req.query.productId as string | undefined;

      const movements = await this.service.getMovements(
        companyId,
        productId
      );
      res.json({ success: true, data: movements });
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };

  // POST /api/inventory/goods-receipt - Process goods receipt from PO
  processGoodsReceipt = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const company = req.company!; // Company context with businessShape
      const validated = GoodsReceiptSchema.parse(req.body);

      const movements = await this.service.processGoodsReceipt(
        companyId,
        validated,
        company.businessShape
      );
      res.status(201).json({ success: true, data: movements });
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };

  // POST /api/inventory/adjust - Manual stock adjustment
  adjustStock = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const company = req.company!; // Company context with businessShape
      const validated = StockAdjustmentSchema.parse(req.body);

      const movement = await this.service.adjustStock(
        companyId,
        validated,
        company.businessShape,
        company.configs
      );
      res.status(201).json({ success: true, data: movement });
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };
}
