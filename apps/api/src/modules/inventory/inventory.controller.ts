import { Request, Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service';
import { GoodsReceiptSchema, StockAdjustmentSchema } from '@sync-erp/shared';

export class InventoryController {
  private service = new InventoryService();

  // GET /api/inventory/stock - Get all stock levels
  getStockLevels = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const stockLevels = await this.service.getStockLevels(companyId);
      res.json({ success: true, data: stockLevels });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/inventory/movements - Get inventory movements
  getMovements = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const productId = req.query.productId as string | undefined;

      const movements = await this.service.getMovements(companyId, productId);
      res.json({ success: true, data: movements });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/inventory/goods-receipt - Process goods receipt from PO
  processGoodsReceipt = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const validated = GoodsReceiptSchema.parse(req.body);

      const movements = await this.service.processGoodsReceipt(companyId, validated);
      res.status(201).json({ success: true, data: movements });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/inventory/adjust - Manual stock adjustment
  adjustStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const validated = StockAdjustmentSchema.parse(req.body);

      const movement = await this.service.adjustStock(companyId, validated);
      res.status(201).json({ success: true, data: movement });
    } catch (error) {
      next(error);
    }
  };
}
