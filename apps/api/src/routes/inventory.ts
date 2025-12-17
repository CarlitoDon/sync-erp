import { Router } from 'express';
import { InventoryController } from '../modules/inventory/inventory.controller';
import { requireActiveShape } from '../middlewares/shapeGuard';

export const inventoryRouter = Router();
const controller = new InventoryController();

// GET /api/inventory/stock - Get all stock levels
inventoryRouter.get('/stock', controller.getStockLevels);

// GET /api/inventory/movements - Get inventory movements
inventoryRouter.get('/movements', controller.getMovements);

// POST /api/inventory/goods-receipt - Process goods receipt from PO
inventoryRouter.post(
  '/goods-receipt',
  requireActiveShape(),
  controller.processGoodsReceipt
);

// POST /api/inventory/adjust - Manual stock adjustment
inventoryRouter.post(
  '/adjust',
  requireActiveShape(),
  controller.adjustStock
);
