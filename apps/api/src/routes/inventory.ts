import { Router, Request, Response, NextFunction } from 'express';
import { InventoryService } from '../services/InventoryService';
import { z } from 'zod';

export const inventoryRouter = Router();
const inventoryService = new InventoryService();

const GoodsReceiptSchema = z.object({
  orderId: z.string().uuid(),
  reference: z.string().optional(),
});

const StockAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int(),
  costPerUnit: z.number().nonnegative(),
  reference: z.string().optional(),
});

// GET /api/inventory/stock - Get all stock levels
inventoryRouter.get('/stock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const stockLevels = await inventoryService.getStockLevels(companyId);
    res.json({ success: true, data: stockLevels });
  } catch (error) {
    next(error);
  }
});

// GET /api/inventory/movements - Get inventory movements
inventoryRouter.get('/movements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const productId = req.query.productId as string | undefined;

    const movements = await inventoryService.getMovements(companyId, productId);
    res.json({ success: true, data: movements });
  } catch (error) {
    next(error);
  }
});

// POST /api/inventory/goods-receipt - Process goods receipt from PO
inventoryRouter.post('/goods-receipt', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const validated = GoodsReceiptSchema.parse(req.body);

    const movements = await inventoryService.processGoodsReceipt(companyId, validated);
    res.status(201).json({ success: true, data: movements });
  } catch (error) {
    next(error);
  }
});

// POST /api/inventory/adjust - Manual stock adjustment
inventoryRouter.post('/adjust', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const validated = StockAdjustmentSchema.parse(req.body);

    const movement = await inventoryService.adjustStock(companyId, validated);
    res.status(201).json({ success: true, data: movement });
  } catch (error) {
    next(error);
  }
});
