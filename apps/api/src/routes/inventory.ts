import { Router } from 'express';
import { InventoryController } from '../modules/inventory/inventory.controller';

export const inventoryRouter = Router();
const controller = new InventoryController();

// GET /api/inventory/stock - Get all stock levels
inventoryRouter.get('/stock', controller.getStockLevels);

// GET /api/inventory/movements - Get inventory movements
inventoryRouter.get('/movements', controller.getMovements);

// POST /api/inventory/goods-receipt - Process goods receipt from PO
inventoryRouter.post('/goods-receipt', controller.processGoodsReceipt);

// POST /api/inventory/adjust - Manual stock adjustment
inventoryRouter.post('/adjust', controller.adjustStock);
